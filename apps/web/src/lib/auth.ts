/** Browser-side auth helpers for contributor flows (JWT in localStorage). */

export type UserRole = 'user' | 'moderator' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  trust_score: number;
  role: UserRole;
  email_verified: boolean;
  display_name?: string | null;
  organization?: string | null;
  location?: string | null;
  pending_email?: string | null;
  email_updates_opt_in?: boolean;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = 'fupe_token';
const USER_KEY = 'fupe_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AuthUser;
    return {
      ...user,
      role: user.role ?? 'user',
      email_verified: Boolean(user.email_verified),
    };
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  window.dispatchEvent(new Event('fupe-auth'));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('fupe-auth'));
}

export function isModerator(user: AuthUser | null): boolean {
  return user?.role === 'moderator' || user?.role === 'admin';
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseAuthResponse(res: Response): Promise<AuthSession> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Auth failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return body as AuthSession;
}

export async function register(
  email: string,
  password: string,
  opts: { email_updates_opt_in?: boolean } = {},
): Promise<AuthSession> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      email_updates_opt_in: Boolean(opts.email_updates_opt_in),
    }),
  });
  const session = await parseAuthResponse(res);
  setSession(session);
  return session;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthSession> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await parseAuthResponse(res);
  setSession(session);
  return session;
}

export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  const user = (await res.json()) as AuthUser;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('fupe-auth'));
  return user;
}

export async function updateMe(
  token: string,
  patch: {
    display_name?: string | null;
    organization?: string | null;
    location?: string | null;
    email_updates_opt_in?: boolean;
  },
): Promise<AuthUser> {
  const res = await fetch('/api/v1/auth/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Update failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  const user = body as AuthUser;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('fupe-auth'));
  return user;
}

export async function requestEmailChange(
  token: string,
  email: string,
  password: string,
): Promise<{ message: string; user: AuthUser }> {
  const res = await fetch('/api/v1/auth/change-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Request failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  const result = body as { message: string; user: AuthUser };
  localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  window.dispatchEvent(new Event('fupe-auth'));
  return result;
}

export async function cancelEmailChange(token: string): Promise<AuthUser> {
  const res = await fetch('/api/v1/auth/change-email/cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Cancel failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  const user = (body as { user: AuthUser }).user;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('fupe-auth'));
  return user;
}

export async function confirmEmailChangeToken(token: string): Promise<AuthUser> {
  const res = await fetch('/api/v1/auth/confirm-email-change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Confirmation failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return (body as { user: AuthUser }).user;
}

export async function verifyEmailToken(token: string): Promise<AuthUser> {
  const res = await fetch('/api/v1/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Verification failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return (body as { user: AuthUser }).user;
}

export async function resendVerification(token: string): Promise<string> {
  const res = await fetch('/api/v1/auth/resend-verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Resend failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return (body as { message: string }).message;
}

export async function exportMyData(token: string): Promise<unknown> {
  const res = await fetch('/api/v1/auth/export', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Export failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return body;
}

export async function deleteMyAccount(token: string): Promise<void> {
  const res = await fetch('/api/v1/auth/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      (body as { message?: string | string[] }).message ?? 'Delete failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  clearSession();
}

async function parseMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Request failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return (body as { message: string }).message ?? 'OK';
}

export async function forgotPassword(email: string): Promise<string> {
  const res = await fetch('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseMessage(res);
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<string> {
  const res = await fetch('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  return parseMessage(res);
}

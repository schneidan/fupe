/** Browser-side auth helpers for contributor flows (JWT in localStorage). */

export type UserRole = 'user' | 'moderator' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  trust_score: number;
  role: UserRole;
  email_verified: boolean;
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
): Promise<AuthSession> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
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

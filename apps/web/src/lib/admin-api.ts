/**
 * Admin API client — all calls go to /api/v1/admin/* via the Next.js proxy.
 * All endpoints require `role === 'admin'` on the server; the token is the
 * same JWT used everywhere else.
 */

import { getToken } from './auth';

const BASE = '/api/v1/admin';

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { message?: string | string[] }).message ?? 'Admin request failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return body as T;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  trust_score: number;
  email_verified_at: string | null;
  subscription_tier: 'free' | 'developer' | 'business';
  subscription_status: string | null;
  stripe_customer_id: string | null;
  api_key_count: number;
  pending_edit_count: number;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  verified_users: number;
  paid_subscribers: number;
  pending_edits: number;
  total_api_keys: number;
}

export interface AdminSubscriber {
  id: string;
  email: string;
  role: string;
  subscription_tier: string;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

export interface AdminKeyUsage {
  id: string;
  name: string;
  key_prefix: string;
  tier: string;
  email: string;
  requests_today: number;
  blocked_today: number;
}

// ── Endpoints ─────────────────────────────────────────────────────────────

export function fetchAdminStats() {
  return adminFetch<AdminStats>('/stats');
}

export function fetchAdminUsers(params?: { q?: string; role?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.role) qs.set('role', params.role);
  if (params?.page) qs.set('page', String(params.page));
  return adminFetch<{ users: AdminUser[]; total: number }>(`/users?${qs}`);
}

export function patchAdminUser(
  id: string,
  patch: { role?: string; trust_score?: number; email_verified?: boolean },
) {
  return adminFetch<AdminUser>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function fetchUserKeys(userId: string) {
  return adminFetch<{ id: string; name: string; key_prefix: string; tier: string; usage_today: number; revoked_at: string | null }[]>(`/users/${userId}/keys`);
}

export function revokeKeyAdmin(keyId: string) {
  return adminFetch<{ revoked: boolean }>(`/keys/${keyId}/revoke`, { method: 'POST' });
}

export function fetchAdminSubscriptions(params?: { page?: number }) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  return adminFetch<{ subscribers: AdminSubscriber[]; total: number }>(`/subscriptions?${qs}`);
}

export function overrideTier(userId: string, tier: 'free' | 'developer' | 'business') {
  return adminFetch<AdminUser>(`/users/${userId}/tier`, {
    method: 'POST',
    body: JSON.stringify({ tier }),
  });
}

export function fetchUsageSummary(params?: { page?: number }) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  return adminFetch<{ usage: AdminKeyUsage[] }>(`/usage?${qs}`);
}

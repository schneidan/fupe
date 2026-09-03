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
  disabled_at: string | null;
  api_key_count: number;
  pending_edit_count: number;
  created_at: string;
}

export interface AdminUserKey {
  id: string;
  name: string;
  key_prefix: string;
  tier: string;
  rate_limit_daily: number;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  usage_today: number;
}

export interface AdminStats {
  total_users: number;
  verified_users: number;
  new_users_24h: number;
  new_users_7d: number;
  paid_subscribers: number;
  pending_edits: number;
  pending_ingest_matches: number;
  total_api_keys: number;
  requests_today: number;
  audit_actions_7d: number;
}

export interface AdminSubscriber {
  id: string;
  email: string;
  role: string;
  subscription_tier: string;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_current_period_end: string | null;
  created_at: string;
}

export interface BillingHealth {
  stripe_configured: boolean;
  webhook_secret_set: boolean;
  stripe_mode: 'test' | 'live' | 'unset';
  dashboard_url: string;
  last_event_at: string | null;
  last_event_type: string | null;
  events_last_7d: number;
  stale: boolean;
}

export interface AdminAuditEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
}

export interface AdminKeyUsage {
  id: string;
  name: string;
  key_prefix: string;
  tier: string;
  email: string;
  requests_today: number;
  image_blocks_today: number;
  rate_limit_hits_today: number;
}

export type AdminUserPatch = {
  role?: string;
  trust_score?: number;
  email_verified?: boolean;
  disabled?: boolean;
};

// ── Endpoints ─────────────────────────────────────────────────────────────

export function fetchAdminStats() {
  return adminFetch<AdminStats>('/stats');
}

export function fetchAdminUsers(params?: {
  q?: string;
  role?: string;
  disabled?: boolean;
  page?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.role) qs.set('role', params.role);
  if (params?.disabled !== undefined) qs.set('disabled', String(params.disabled));
  if (params?.page) qs.set('page', String(params.page));
  return adminFetch<{ users: AdminUser[]; total: number }>(`/users?${qs}`);
}

export function fetchAdminUser(id: string) {
  return adminFetch<AdminUser>(`/users/${id}`);
}

export function patchAdminUser(id: string, patch: AdminUserPatch) {
  return adminFetch<AdminUser>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function fetchUserKeys(userId: string) {
  return adminFetch<{ keys: AdminUserKey[] }>(`/users/${userId}/keys`);
}

export function revokeKeyAdmin(keyId: string) {
  return adminFetch<{ revoked: boolean }>(`/keys/${keyId}/revoke`, { method: 'POST' });
}

export function fetchAdminSubscriptions(params?: { page?: number }) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  return adminFetch<{ subscribers: AdminSubscriber[]; total: number }>(`/subscriptions?${qs}`);
}

export function fetchBillingHealth() {
  return adminFetch<BillingHealth>('/billing/health');
}

export function fetchAdminAudit(params?: {
  action?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.action) qs.set('action', params.action);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  return adminFetch<{ entries: AdminAuditEntry[]; total: number }>(`/audit?${qs}`);
}

export function overrideTier(
  userId: string,
  tier: 'free' | 'developer' | 'business',
  note?: string,
) {
  return adminFetch<AdminUser>(`/users/${userId}/tier`, {
    method: 'POST',
    body: JSON.stringify({ tier, ...(note ? { note } : {}) }),
  });
}

export function fetchUsageSummary(params?: { page?: number }) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  return adminFetch<{ usage: AdminKeyUsage[] }>(`/usage?${qs}`);
}

export interface IngestMatch {
  id: string;
  incoming_entity: Record<string, unknown>;
  candidate_entity_id: string | null;
  candidate_name: string | null;
  score: number;
  match_reason: string;
  status: string;
  source_id: string | null;
  created_at: string;
}

export function fetchIngestMatches(params?: { status?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.page) qs.set('page', String(params.page));
  return adminFetch<{ matches: IngestMatch[]; total: number }>(
    `/ingest-matches?${qs}`,
  );
}

export function resolveIngestMatch(
  id: string,
  decision: 'accepted' | 'rejected' | 'merged',
) {
  return adminFetch<IngestMatch>(`/ingest-matches/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}

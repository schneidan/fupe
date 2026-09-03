import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants';
import { UserRow, UserRole } from '../auth/users.repository';

export interface AdminUserRow extends UserRow {
  api_key_count: number;
  pending_edit_count: number;
}

export interface AdminStats {
  total_users: number;
  verified_users: number;
  paid_subscribers: number;
  pending_edits: number;
  total_api_keys: number;
}

@Injectable()
export class AdminService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  // ─── Users ────────────────────────────────────────────────────────────────

  async listUsers(params: {
    q?: string;
    role?: UserRole;
    page: number;
    limit: number;
  }): Promise<{ users: AdminUserRow[]; total: number }> {
    const { q, role, page, limit } = params;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (q) {
      conditions.push(`u.email ILIKE $${i++}`);
      values.push(`%${q}%`);
    }
    if (role) {
      conditions.push(`u.role = $${i++}`);
      values.push(role);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.users u ${where}`,
      values,
    );

    const { rows } = await this.pool.query<AdminUserRow>(
      `SELECT u.*,
              (SELECT count(*) FROM public.api_keys k WHERE k.user_id = u.id AND k.revoked_at IS NULL)::int AS api_key_count,
              (SELECT count(*) FROM public.edits_queue e WHERE e.user_id = u.id AND e.status = 'PENDING')::int AS pending_edit_count
         FROM public.users u
         ${where}
         ORDER BY u.created_at DESC
         LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset],
    );

    return { users: rows, total: Number(countRes.rows[0]?.n ?? 0) };
  }

  async updateUser(
    userId: string,
    patch: {
      role?: UserRole;
      trust_score?: number;
      email_verified?: boolean;
    },
  ): Promise<UserRow> {
    const sets: string[] = [];
    const values: unknown[] = [userId];
    let i = 2;

    if (patch.role !== undefined) {
      sets.push(`role = $${i++}`);
      values.push(patch.role);
    }
    if (patch.trust_score !== undefined) {
      sets.push(`trust_score = GREATEST(0, LEAST(100, $${i++}::int))`);
      values.push(patch.trust_score);
    }
    if (patch.email_verified !== undefined) {
      if (patch.email_verified) {
        sets.push(`email_verified_at = COALESCE(email_verified_at, now())`);
        sets.push(`email_verify_token = NULL`);
        sets.push(`email_verify_expires_at = NULL`);
      } else {
        sets.push(`email_verified_at = NULL`);
      }
    }

    if (sets.length === 0) {
      const { rows } = await this.pool.query<UserRow>(
        'SELECT * FROM public.users WHERE id = $1',
        [userId],
      );
      return rows[0];
    }

    const { rows } = await this.pool.query<UserRow>(
      `UPDATE public.users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return rows[0];
  }

  async getUserKeys(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT k.*, 
              (SELECT count(*) FROM public.api_usage_log l 
               WHERE l.api_key_id = k.id 
                 AND l.created_at >= date_trunc('day', now()))::int AS usage_today
         FROM public.api_keys k 
        WHERE k.user_id = $1 
        ORDER BY k.created_at DESC`,
      [userId],
    );
    return rows;
  }

  async revokeKeyAdmin(keyId: string) {
    await this.pool.query(
      `UPDATE public.api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
      [keyId],
    );
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(): Promise<AdminStats> {
    const { rows } = await this.pool.query<AdminStats>(`
      SELECT
        (SELECT count(*)::int FROM public.users) AS total_users,
        (SELECT count(*)::int FROM public.users WHERE email_verified_at IS NOT NULL) AS verified_users,
        (SELECT count(*)::int FROM public.users WHERE subscription_tier IN ('developer','business') AND subscription_status = 'active') AS paid_subscribers,
        (SELECT count(*)::int FROM public.edits_queue WHERE status = 'PENDING') AS pending_edits,
        (SELECT count(*)::int FROM public.api_keys WHERE revoked_at IS NULL) AS total_api_keys
    `);
    return rows[0];
  }

  // ─── Subscriptions ────────────────────────────────────────────────────────

  async listSubscribers(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const countRes = await this.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.users WHERE subscription_tier != 'free' OR subscription_status IS NOT NULL`,
    );

    const { rows } = await this.pool.query(
      `SELECT id, email, role, subscription_tier, subscription_status, stripe_customer_id,
              stripe_subscription_id, created_at
         FROM public.users
        WHERE subscription_tier != 'free' OR subscription_status IS NOT NULL
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return { subscribers: rows, total: Number(countRes.rows[0]?.n ?? 0) };
  }

  async overrideTier(
    userId: string,
    tier: 'free' | 'developer' | 'business',
  ): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE public.users
          SET subscription_tier = $2,
              subscription_status = 'admin_override'
        WHERE id = $1
        RETURNING *`,
      [userId, tier],
    );
    return rows[0];
  }

  // ─── Usage overview ───────────────────────────────────────────────────────

  async getUsageSummary(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const { rows } = await this.pool.query(
      `SELECT k.id, k.name, k.key_prefix, k.tier, u.email,
              count(l.id)::int AS requests_today,
              count(l.id) FILTER (WHERE l.status_code = 403)::int AS blocked_today
         FROM public.api_keys k
         JOIN public.users u ON u.id = k.user_id
    LEFT JOIN public.api_usage_log l ON l.api_key_id = k.id
          AND l.created_at >= date_trunc('day', now())
        WHERE k.revoked_at IS NULL
        GROUP BY k.id, k.name, k.key_prefix, k.tier, u.email
        ORDER BY requests_today DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return { usage: rows };
  }
}

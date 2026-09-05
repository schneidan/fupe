import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants';
import { UserRole } from '../auth/users.repository';
import { TIER_LIMITS } from '../api-keys/api-keys.service';
import { writeAdminAudit } from './audit-log';

const WEBHOOK_STALE_MS = 48 * 60 * 60 * 1000;

/** Safe admin projection — never select password / verify / reset secrets. */
const ADMIN_USER_COLUMNS = `
  u.id,
  u.email,
  u.trust_score,
  u.role,
  u.email_verified_at,
  u.subscription_tier,
  u.subscription_status,
  u.stripe_customer_id,
  u.stripe_subscription_id,
  u.subscription_current_period_end,
  u.disabled_at,
  u.created_at
`;

export interface AdminUserRow {
  id: string;
  email: string;
  trust_score: number;
  role: UserRole;
  email_verified_at: Date | null;
  subscription_tier: 'free' | 'developer' | 'business';
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_current_period_end: Date | null;
  disabled_at: Date | null;
  created_at: Date;
  api_key_count: number;
  pending_edit_count: number;
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

export interface AdminApiKeyRow {
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

export interface AdminAuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  previous_state: unknown;
  new_state: unknown;
  note: string | null;
  created_at: string;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
  ) {}

  // ─── Users ────────────────────────────────────────────────────────────────

  async listUsers(params: {
    q?: string;
    role?: UserRole;
    disabled?: boolean;
    page: number;
    limit: number;
  }): Promise<{ users: AdminUserRow[]; total: number }> {
    const { q, role, disabled, page, limit } = params;
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
    if (disabled === true) {
      conditions.push(`u.disabled_at IS NOT NULL`);
    } else if (disabled === false) {
      conditions.push(`u.disabled_at IS NULL`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.users u ${where}`,
      values,
    );

    const { rows } = await this.pool.query<AdminUserRow>(
      `SELECT ${ADMIN_USER_COLUMNS},
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

  async getUser(userId: string): Promise<AdminUserRow> {
    const { rows } = await this.pool.query<AdminUserRow>(
      `SELECT ${ADMIN_USER_COLUMNS},
              (SELECT count(*) FROM public.api_keys k WHERE k.user_id = u.id AND k.revoked_at IS NULL)::int AS api_key_count,
              (SELECT count(*) FROM public.edits_queue e WHERE e.user_id = u.id AND e.status = 'PENDING')::int AS pending_edit_count
         FROM public.users u
        WHERE u.id = $1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('User not found');
    return rows[0];
  }

  async updateUser(
    actorId: string,
    userId: string,
    patch: {
      role?: UserRole;
      trust_score?: number;
      email_verified?: boolean;
      disabled?: boolean;
    },
  ): Promise<AdminUserRow> {
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    if (actorId === userId) {
      if (patch.role && patch.role !== 'admin') {
        throw new ForbiddenException('You cannot demote your own admin role');
      }
      if (patch.disabled === true) {
        throw new ForbiddenException('You cannot disable your own account');
      }
    }

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
    if (patch.disabled !== undefined) {
      sets.push(
        patch.disabled
          ? `disabled_at = COALESCE(disabled_at, now())`
          : `disabled_at = NULL`,
      );
    }

    if (sets.length === 0) {
      return this.getUser(userId);
    }

    const previous = await this.getUser(userId);

    const { rowCount } = await this.pool.query(
      `UPDATE public.users SET ${sets.join(', ')} WHERE id = $1`,
      values,
    );
    if (!rowCount) throw new NotFoundException('User not found');

    await writeAdminAudit(this.pool, {
      actorId,
      action: 'user_update',
      targetType: 'user',
      targetId: userId,
      previousState: {
        role: previous.role,
        trust_score: previous.trust_score,
        email_verified: Boolean(previous.email_verified_at),
        disabled: Boolean(previous.disabled_at),
      },
      newState: {
        role: patch.role ?? previous.role,
        trust_score: patch.trust_score ?? previous.trust_score,
        email_verified:
          patch.email_verified !== undefined
            ? patch.email_verified
            : Boolean(previous.email_verified_at),
        disabled:
          patch.disabled !== undefined
            ? patch.disabled
            : Boolean(previous.disabled_at),
      },
    });

    // Disabling should revoke active API keys so they stop working immediately
    if (patch.disabled === true) {
      await this.pool.query(
        `UPDATE public.api_keys SET revoked_at = now()
          WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
    }

    return this.getUser(userId);
  }

  async getUserKeys(userId: string): Promise<AdminApiKeyRow[]> {
    await this.getUser(userId);
    const { rows } = await this.pool.query<{
      id: string;
      name: string;
      key_prefix: string;
      tier: string;
      rate_limit_daily: number;
      last_used_at: Date | null;
      revoked_at: Date | null;
      created_at: Date;
      usage_today: number;
    }>(
      `SELECT k.id, k.name, k.key_prefix, k.tier, k.rate_limit_daily,
              k.last_used_at, k.revoked_at, k.created_at,
              (SELECT count(*) FROM public.api_usage_log l
                WHERE l.api_key_id = k.id
                  AND l.created_at >= date_trunc('day', now()))::int AS usage_today
         FROM public.api_keys k
        WHERE k.user_id = $1
        ORDER BY k.created_at DESC`,
      [userId],
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      key_prefix: r.key_prefix,
      tier: r.tier,
      rate_limit_daily: r.rate_limit_daily ?? TIER_LIMITS.free,
      last_used_at: r.last_used_at?.toISOString() ?? null,
      revoked_at: r.revoked_at?.toISOString() ?? null,
      created_at: r.created_at.toISOString(),
      usage_today: r.usage_today,
    }));
  }

  async revokeKeyAdmin(actorId: string, keyId: string) {
    const { rows } = await this.pool.query<{ id: string; user_id: string; key_prefix: string }>(
      `UPDATE public.api_keys SET revoked_at = now()
        WHERE id = $1 AND revoked_at IS NULL
        RETURNING id, user_id, key_prefix`,
      [keyId],
    );
    if (!rows[0]) throw new NotFoundException('API key not found or already revoked');
    await writeAdminAudit(this.pool, {
      actorId,
      action: 'key_revoke',
      targetType: 'api_key',
      targetId: keyId,
      previousState: { revoked: false, user_id: rows[0].user_id },
      newState: { revoked: true, key_prefix: rows[0].key_prefix },
    });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(): Promise<AdminStats> {
    const { rows } = await this.pool.query<AdminStats>(`
      SELECT
        (SELECT count(*)::int FROM public.users WHERE disabled_at IS NULL) AS total_users,
        (SELECT count(*)::int FROM public.users WHERE email_verified_at IS NOT NULL AND disabled_at IS NULL) AS verified_users,
        (SELECT count(*)::int FROM public.users WHERE created_at >= now() - interval '24 hours') AS new_users_24h,
        (SELECT count(*)::int FROM public.users WHERE created_at >= now() - interval '7 days') AS new_users_7d,
        (SELECT count(*)::int FROM public.users WHERE subscription_tier IN ('developer','business') AND subscription_status IN ('active', 'trialing', 'admin_override')) AS paid_subscribers,
        (SELECT count(*)::int FROM public.edits_queue WHERE status = 'PENDING') AS pending_edits,
        (SELECT count(*)::int FROM public.ingest_match_queue WHERE status = 'pending') AS pending_ingest_matches,
        (SELECT count(*)::int FROM public.api_keys WHERE revoked_at IS NULL) AS total_api_keys,
        (SELECT count(*)::int FROM public.api_usage_log WHERE created_at >= date_trunc('day', now())) AS requests_today,
        (SELECT count(*)::int FROM public.admin_audit_log WHERE created_at >= now() - interval '7 days') AS audit_actions_7d
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
              stripe_subscription_id, subscription_current_period_end, created_at
         FROM public.users
        WHERE subscription_tier != 'free' OR subscription_status IS NOT NULL
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return { subscribers: rows, total: Number(countRes.rows[0]?.n ?? 0) };
  }

  stripeMode(): 'test' | 'live' | 'unset' {
    const key = this.config.get<string>('STRIPE_SECRET_KEY')?.trim() ?? '';
    if (key.startsWith('sk_live_')) return 'live';
    if (key.startsWith('sk_test_')) return 'test';
    return key ? 'test' : 'unset';
  }

  async getBillingHealth(): Promise<BillingHealth> {
    const stripeConfigured = Boolean(
      this.config.get<string>('STRIPE_SECRET_KEY')?.trim() &&
        this.config.get<string>('STRIPE_PRICE_DEVELOPER')?.trim(),
    );
    const webhookSecretSet = Boolean(
      this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim(),
    );
    const mode = this.stripeMode();
    const dashboard_url =
      mode === 'live'
        ? 'https://dashboard.stripe.com/subscriptions'
        : 'https://dashboard.stripe.com/test/subscriptions';

    const last = await this.pool.query<{
      received_at: Date;
      event_type: string;
    }>(
      `SELECT received_at, event_type
         FROM public.stripe_webhook_log
        ORDER BY received_at DESC
        LIMIT 1`,
    );
    const week = await this.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM public.stripe_webhook_log
        WHERE received_at >= now() - interval '7 days'`,
    );

    const last_event_at = last.rows[0]?.received_at?.toISOString() ?? null;
    const last_event_type = last.rows[0]?.event_type ?? null;
    const ageMs = last.rows[0]
      ? Date.now() - last.rows[0].received_at.getTime()
      : null;
    const stale =
      stripeConfigured && (ageMs === null || ageMs > WEBHOOK_STALE_MS);

    return {
      stripe_configured: stripeConfigured,
      webhook_secret_set: webhookSecretSet,
      stripe_mode: mode,
      dashboard_url,
      last_event_at,
      last_event_type,
      events_last_7d: Number(week.rows[0]?.n ?? 0),
      stale,
    };
  }

  async listAudit(params: {
    action?: string;
    page: number;
    limit: number;
  }): Promise<{ entries: AdminAuditRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const countRes = await this.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.admin_audit_log
        WHERE ($1::text IS NULL OR action = $1)`,
      [params.action ?? null],
    );

    const { rows } = await this.pool.query<{
      id: string;
      actor_id: string | null;
      actor_email: string | null;
      action: string;
      target_type: string;
      target_id: string;
      previous_state: unknown;
      new_state: unknown;
      note: string | null;
      created_at: Date;
    }>(
      `SELECT a.id, a.actor_id, u.email AS actor_email, a.action, a.target_type,
              a.target_id, a.previous_state, a.new_state, a.note, a.created_at
         FROM public.admin_audit_log a
    LEFT JOIN public.users u ON u.id = a.actor_id
        WHERE ($1::text IS NULL OR a.action = $1)
        ORDER BY a.created_at DESC
        LIMIT $2 OFFSET $3`,
      [params.action ?? null, params.limit, offset],
    );

    return {
      total: Number(countRes.rows[0]?.n ?? 0),
      entries: rows.map((r) => ({
        ...r,
        created_at: r.created_at.toISOString(),
      })),
    };
  }

  async overrideTier(
    actorId: string,
    userId: string,
    tier: 'free' | 'developer' | 'business',
    note?: string,
  ): Promise<AdminUserRow> {
    const previous = await this.getUser(userId);
    const { rows } = await this.pool.query<{ id: string }>(
      `UPDATE public.users
          SET subscription_tier = $2,
              subscription_status = 'admin_override'
        WHERE id = $1
        RETURNING id`,
      [userId, tier],
    );
    if (!rows[0]) throw new NotFoundException('User not found');

    await this.pool.query(
      `UPDATE public.api_keys
          SET tier = $2, rate_limit_daily = $3
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, tier, TIER_LIMITS[tier]],
    );

    await writeAdminAudit(this.pool, {
      actorId,
      action: 'tier_override',
      targetType: 'user',
      targetId: userId,
      previousState: {
        subscription_tier: previous.subscription_tier,
        subscription_status: previous.subscription_status,
      },
      newState: {
        subscription_tier: tier,
        subscription_status: 'admin_override',
      },
      note: note?.trim() || null,
    });

    return this.getUser(userId);
  }

  // ─── Usage overview ───────────────────────────────────────────────────────

  async getUsageSummary(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const { rows } = await this.pool.query(
      `SELECT k.id, k.name, k.key_prefix, k.tier, u.email,
              count(l.id)::int AS requests_today,
              count(l.id) FILTER (
                WHERE l.status_code = 403 AND l.endpoint ILIKE '%lookup%'
              )::int AS image_blocks_today,
              count(l.id) FILTER (WHERE l.status_code = 429)::int AS rate_limit_hits_today
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

  // ─── Ingest match queue ───────────────────────────────────────────────────

  async listIngestMatches(params: {
    status?: string;
    page: number;
    limit: number;
  }) {
    const status = params.status ?? 'pending';
    const offset = (params.page - 1) * params.limit;

    const countRes = await this.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.ingest_match_queue WHERE status = $1`,
      [status],
    );

    const { rows } = await this.pool.query(
      `SELECT id, incoming_entity, candidate_entity_id, candidate_name, score,
              match_reason, status, source_id, ingestion_run_id, created_at, resolved_at
         FROM public.ingest_match_queue
        WHERE status = $1
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3`,
      [status, params.limit, offset],
    );

    return {
      matches: rows,
      total: Number(countRes.rows[0]?.n ?? 0),
    };
  }

  async resolveIngestMatch(
    actorId: string,
    id: string,
    decision: 'accepted' | 'rejected' | 'merged',
  ) {
    const { rows } = await this.pool.query(
      `UPDATE public.ingest_match_queue
          SET status = $2, resolved_at = now()
        WHERE id = $1 AND status = 'pending'
        RETURNING *`,
      [id, decision],
    );
    if (!rows[0]) {
      throw new NotFoundException('Ingest match not found or already resolved');
    }
    await writeAdminAudit(this.pool, {
      actorId,
      action: 'ingest_resolve',
      targetType: 'ingest_match',
      targetId: id,
      previousState: { status: 'pending' },
      newState: { status: decision },
    });
    return rows[0];
  }
}

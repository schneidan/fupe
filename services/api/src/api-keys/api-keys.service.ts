import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants';

export type ApiKeyTier = 'free' | 'developer' | 'business';

export const TIER_LIMITS: Record<ApiKeyTier, number> = {
  free: 100,
  developer: 10_000,
  business: 100_000,
};

export const TIER_ALLOWS_IMAGE: Record<ApiKeyTier, boolean> = {
  free: false,
  developer: true,
  business: true,
};

export interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  tier: ApiKeyTier;
  rate_limit_daily: number;
  last_used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export interface AuthenticatedApiKey {
  id: string;
  userId: string;
  tier: ApiKeyTier;
  rateLimitDaily: number;
  name: string;
}

export interface ApiKeyPublic {
  id: string;
  name: string;
  key_prefix: string;
  tier: ApiKeyTier;
  rate_limit_daily: number;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

@Injectable()
export class ApiKeysService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async createKey(
    userId: string,
    name = 'Default',
    tier: ApiKeyTier = 'free',
  ): Promise<{ key: ApiKeyPublic; rawKey: string }> {
    const rawKey = this.generateRawKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    const { rows } = await this.pool.query<ApiKeyRow>(
      `INSERT INTO public.api_keys (
         user_id, name, key_prefix, key_hash, tier, rate_limit_daily
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        name.trim() || 'Default',
        keyPrefix,
        keyHash,
        tier,
        TIER_LIMITS[tier],
      ],
    );

    return {
      key: this.toPublic(rows[0]),
      rawKey,
    };
  }

  async listForUser(userId: string): Promise<ApiKeyPublic[]> {
    const { rows } = await this.pool.query<ApiKeyRow>(
      `SELECT * FROM public.api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((r) => this.toPublic(r));
  }

  async revoke(userId: string, keyId: string): Promise<ApiKeyPublic> {
    const { rows } = await this.pool.query<ApiKeyRow>(
      `UPDATE public.api_keys
       SET revoked_at = now()
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING *`,
      [keyId, userId],
    );
    if (!rows[0]) {
      throw new NotFoundException('API key not found or already revoked');
    }
    return this.toPublic(rows[0]);
  }

  async findByRawKey(raw: string): Promise<AuthenticatedApiKey | null> {
    const keyHash = hashApiKey(raw);
    const { rows } = await this.pool.query<ApiKeyRow>(
      `SELECT * FROM public.api_keys
       WHERE key_hash = $1 AND revoked_at IS NULL`,
      [keyHash],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      tier: row.tier,
      rateLimitDaily: row.rate_limit_daily,
      name: row.name,
    };
  }

  async touchLastUsed(keyId: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.api_keys SET last_used_at = now() WHERE id = $1`,
      [keyId],
    );
  }

  async logUsage(params: {
    apiKeyId: string;
    endpoint: string;
    method: string;
    statusCode: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.api_usage_log (api_key_id, endpoint, method, status_code)
       VALUES ($1, $2, $3, $4)`,
      [
        params.apiKeyId,
        params.endpoint.slice(0, 500),
        params.method.slice(0, 16),
        params.statusCode,
      ],
    );
  }

  async countUsageToday(apiKeyId: string): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
       FROM public.api_usage_log
       WHERE api_key_id = $1
         AND created_at >= date_trunc('day', now())`,
      [apiKeyId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  /** Sync all of a user's keys to a subscription tier (Stripe webhook). */
  async setTierForUser(userId: string, tier: ApiKeyTier): Promise<void> {
    await this.pool.query(
      `UPDATE public.api_keys
       SET tier = $2, rate_limit_daily = $3
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, tier, TIER_LIMITS[tier]],
    );
  }

  private generateRawKey(): string {
    return `fupe_${randomBytes(24).toString('base64url')}`;
  }

  private toPublic(row: ApiKeyRow): ApiKeyPublic {
    return {
      id: row.id,
      name: row.name,
      key_prefix: row.key_prefix,
      tier: row.tier,
      rate_limit_daily: row.rate_limit_daily,
      last_used_at: row.last_used_at?.toISOString() ?? null,
      revoked_at: row.revoked_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
    };
  }
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

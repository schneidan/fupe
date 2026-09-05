import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants';

export type UserRole = 'user' | 'moderator' | 'admin';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  trust_score: number;
  role: UserRole;
  email_verified_at: Date | null;
  email_verify_token: string | null;
  email_verify_expires_at: Date | null;
  password_reset_token?: string | null;
  password_reset_expires_at?: Date | null;
  subscription_tier?: 'free' | 'developer' | 'business';
  subscription_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_current_period_end?: Date | null;
  disabled_at?: Date | null;
  created_at: Date;
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      'SELECT * FROM public.users WHERE email = $1',
      [email.toLowerCase()],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      'SELECT * FROM public.users WHERE id = $1',
      [id],
    );
    return rows[0] ?? null;
  }

  async findByVerifyToken(token: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT * FROM public.users
       WHERE email_verify_token = $1
         AND email_verify_expires_at > now()`,
      [token],
    );
    return rows[0] ?? null;
  }

  async create(params: {
    email: string;
    passwordHash: string;
    trustScore?: number;
    role?: UserRole;
    emailVerifiedAt?: Date | null;
    verifyToken?: string | null;
    verifyExpiresAt?: Date | null;
  }): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO public.users (
         email, password_hash, trust_score, role,
         email_verified_at, email_verify_token, email_verify_expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        params.email.toLowerCase(),
        params.passwordHash,
        params.trustScore ?? 0,
        params.role ?? 'user',
        params.emailVerifiedAt ?? null,
        params.verifyToken ?? null,
        params.verifyExpiresAt ?? null,
      ],
    );
    return rows[0];
  }

  async setVerifyToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE public.users
       SET email_verify_token = $2,
           email_verify_expires_at = $3
       WHERE id = $1`,
      [userId, token, expiresAt],
    );
  }

  async markEmailVerified(userId: string): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE public.users
       SET email_verified_at = now(),
           email_verify_token = NULL,
           email_verify_expires_at = NULL
       WHERE id = $1
       RETURNING *`,
      [userId],
    );
    return rows[0];
  }

  async findByPasswordResetToken(token: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT * FROM public.users
       WHERE password_reset_token = $1
         AND password_reset_expires_at > now()
         AND disabled_at IS NULL`,
      [token],
    );
    return rows[0] ?? null;
  }

  async setPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE public.users
       SET password_reset_token = $2,
           password_reset_expires_at = $3
       WHERE id = $1`,
      [userId, token, expiresAt],
    );
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.users
       SET password_reset_token = NULL,
           password_reset_expires_at = NULL
       WHERE id = $1`,
      [userId],
    );
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE public.users
       SET password_hash = $2,
           password_reset_token = NULL,
           password_reset_expires_at = NULL
       WHERE id = $1
       RETURNING *`,
      [userId, passwordHash],
    );
    return rows[0];
  }

  async setRole(userId: string, role: UserRole): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE public.users SET role = $2 WHERE id = $1 RETURNING *`,
      [userId, role],
    );
    return rows[0];
  }

  async adjustTrustScore(userId: string, delta: number): Promise<number> {
    const { rows } = await this.pool.query<{ trust_score: number }>(
      `UPDATE public.users
       SET trust_score = GREATEST(0, LEAST(100, trust_score + $2))
       WHERE id = $1
       RETURNING trust_score`,
      [userId, delta],
    );
    return rows[0]?.trust_score ?? 0;
  }

  async findByStripeCustomerId(customerId: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT * FROM public.users WHERE stripe_customer_id = $1`,
      [customerId],
    );
    return rows[0] ?? null;
  }

  async setStripeCustomerId(
    userId: string,
    customerId: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE public.users SET stripe_customer_id = $2 WHERE id = $1`,
      [userId, customerId],
    );
  }

  async setSubscription(params: {
    userId: string;
    tier: 'free' | 'developer' | 'business';
    status: string | null;
    subscriptionId: string | null;
    currentPeriodEnd?: Date | null;
  }): Promise<UserRow> {
    const touchPeriod = params.currentPeriodEnd !== undefined;
    const { rows } = await this.pool.query<UserRow>(
      touchPeriod
        ? `UPDATE public.users
           SET subscription_tier = $2,
               subscription_status = $3,
               stripe_subscription_id = $4,
               subscription_current_period_end = $5
           WHERE id = $1
           RETURNING *`
        : `UPDATE public.users
           SET subscription_tier = $2,
               subscription_status = $3,
               stripe_subscription_id = $4
           WHERE id = $1
           RETURNING *`,
      touchPeriod
        ? [
            params.userId,
            params.tier,
            params.status,
            params.subscriptionId,
            params.currentPeriodEnd,
          ]
        : [params.userId, params.tier, params.status, params.subscriptionId],
    );
    return rows[0];
  }

  async exportPersonalData(userId: string) {
    const user = await this.findById(userId);
    if (!user) return null;

    const edits = await this.pool.query(
      `SELECT id, target_node_id, proposed_data, citation_url, status,
              reviewed_at, created_at
         FROM public.edits_queue WHERE user_id = $1
         ORDER BY created_at DESC`,
      [userId],
    );
    const keys = await this.pool.query(
      `SELECT id, name, key_prefix, tier, rate_limit_daily, last_used_at,
              revoked_at, created_at
         FROM public.api_keys WHERE user_id = $1
         ORDER BY created_at DESC`,
      [userId],
    );

    return {
      exported_at: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        role: user.role,
        trust_score: user.trust_score,
        email_verified_at: user.email_verified_at,
        subscription_tier: user.subscription_tier ?? 'free',
        subscription_status: user.subscription_status ?? null,
        created_at: user.created_at,
      },
      edits: edits.rows,
      api_keys: keys.rows,
    };
  }

  async deleteAccount(userId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE public.edits_queue SET reviewer_id = NULL WHERE reviewer_id = $1`,
        [userId],
      );
      await client.query(
        `UPDATE public.admin_audit_log SET actor_id = NULL WHERE actor_id = $1`,
        [userId],
      );
      await client.query(`DELETE FROM public.audit_logs WHERE edited_by = $1`, [
        userId,
      ]);
      await client.query(
        `DELETE FROM public.wiki_revisions WHERE edited_by = $1`,
        [userId],
      );
      await client.query(`DELETE FROM public.users WHERE id = $1`, [userId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

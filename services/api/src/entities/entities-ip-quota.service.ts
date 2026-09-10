import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants';
import type { EntitiesIpBucket } from './entities-ip.decorators';

@Injectable()
export class EntitiesIpQuotaService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  listDailyLimit(): number {
    return Number(process.env.ENTITIES_IP_LIST_DAILY ?? 100);
  }

  detailDailyLimit(): number {
    return Number(process.env.ENTITIES_IP_DETAIL_DAILY ?? 1000);
  }

  limitFor(bucket: EntitiesIpBucket): number {
    return bucket === 'entities_list'
      ? this.listDailyLimit()
      : this.detailDailyLimit();
  }

  /**
   * Atomically increment today's IP usage if under the daily limit.
   * Returns allowed=false when the cap would be exceeded.
   */
  async tryConsume(
    clientIp: string,
    bucket: EntitiesIpBucket,
    dailyLimit: number,
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    if (dailyLimit <= 0) {
      return { allowed: true, used: 0, limit: dailyLimit };
    }

    const { rowCount } = await this.pool.query(
      `INSERT INTO public.ip_daily_usage (client_ip, bucket, usage_date, request_count)
       VALUES ($1, $2, CURRENT_DATE, 1)
       ON CONFLICT (client_ip, bucket, usage_date)
       DO UPDATE
         SET request_count = public.ip_daily_usage.request_count + 1
       WHERE public.ip_daily_usage.request_count < $3`,
      [clientIp, bucket, dailyLimit],
    );

    if ((rowCount ?? 0) > 0) {
      const { rows } = await this.pool.query<{ request_count: number }>(
        `SELECT request_count FROM public.ip_daily_usage
          WHERE client_ip = $1 AND bucket = $2 AND usage_date = CURRENT_DATE`,
        [clientIp, bucket],
      );
      return {
        allowed: true,
        used: rows[0]?.request_count ?? 1,
        limit: dailyLimit,
      };
    }

    const { rows } = await this.pool.query<{ request_count: number }>(
      `SELECT request_count FROM public.ip_daily_usage
        WHERE client_ip = $1 AND bucket = $2 AND usage_date = CURRENT_DATE`,
      [clientIp, bucket],
    );
    return {
      allowed: false,
      used: rows[0]?.request_count ?? dailyLimit,
      limit: dailyLimit,
    };
  }
}

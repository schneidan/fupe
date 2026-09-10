import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { secretsEqual } from '../common/security';
import { clientIpFromRequest } from '../common/client-ip';
import type { AuthenticatedApiKey } from '../api-keys/api-keys.service';
import {
  ENTITIES_IP_BUCKET_KEY,
  type EntitiesIpBucket,
} from './entities-ip.decorators';
import { EntitiesIpQuotaService } from './entities-ip-quota.service';

type IncomingRequest = {
  ip?: string;
  ips?: string[];
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  header?(name: string): string | undefined;
  apiKey?: AuthenticatedApiKey;
};

/**
 * Anonymous directory scrape protection:
 * - Per-minute burst (in-process)
 * - Daily list vs detail budgets (Postgres)
 * Skips keyed traffic (tier quota already applied) and first-party secret.
 */
@Injectable()
export class EntitiesIpThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs = 60_000;
  private readonly maxPerWindow = Number(
    process.env.ENTITIES_IP_RATE_LIMIT_PER_MIN ?? 60,
  );

  constructor(
    private readonly reflector: Reflector,
    private readonly quota: EntitiesIpQuotaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bucket = this.reflector.getAllAndOverride<EntitiesIpBucket | undefined>(
      ENTITIES_IP_BUCKET_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!bucket) return true;

    const req = context.switchToHttp().getRequest<IncomingRequest>();

    // Keyed requests use api_key_daily_usage / tier limits only.
    if (req.apiKey) return true;

    if (this.isFirstParty(req)) return true;

    const ip = clientIpFromRequest(req);
    this.enforceBurst(ip);

    const dailyLimit = this.quota.limitFor(bucket);
    const { allowed, limit } = await this.quota.tryConsume(ip, bucket, dailyLimit);
    if (!allowed) {
      const kind = bucket === 'entities_list' ? 'directory list' : 'entity detail';
      throw new HttpException(
        `Anonymous ${kind} limit exceeded (${limit}/day per IP). Use an API key at /developers for higher limits.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private enforceBurst(ip: string): void {
    if (this.maxPerWindow <= 0) return;

    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(ip) ?? []).filter((t) => t > cutoff);

    if (recent.length >= this.maxPerWindow) {
      throw new HttpException(
        'Too many entity requests from this IP. Try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.hits.set(ip, recent);

    if (this.hits.size > 10_000) {
      for (const [key, times] of this.hits) {
        const kept = times.filter((t) => t > cutoff);
        if (kept.length === 0) this.hits.delete(key);
        else this.hits.set(key, kept);
      }
    }
  }

  private isFirstParty(req: IncomingRequest): boolean {
    const expected = process.env.FIRST_PARTY_LOOKUP_SECRET?.trim();
    if (!expected) return false;
    const header =
      (typeof req.header === 'function'
        ? req.header('x-fupe-first-party')
        : undefined) ??
      (typeof req.headers['x-fupe-first-party'] === 'string'
        ? req.headers['x-fupe-first-party']
        : Array.isArray(req.headers['x-fupe-first-party'])
          ? req.headers['x-fupe-first-party'][0]
          : '') ??
      '';
    return secretsEqual(header.trim(), expected);
  }
}

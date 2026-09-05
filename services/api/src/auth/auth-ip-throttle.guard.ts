import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

type IncomingRequest = {
  ip?: string;
  ips?: string[];
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

/**
 * In-process IP throttle for auth endpoints (login/register/forgot/reset/resend).
 */
@Injectable()
export class AuthIpThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs = 60_000;
  private readonly maxPerWindow = Number(
    process.env.AUTH_IP_RATE_LIMIT_PER_MIN ?? 20,
  );

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<IncomingRequest>();
    const ip = this.clientIp(req);
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(ip) ?? []).filter((t) => t > cutoff);

    if (recent.length >= this.maxPerWindow) {
      throw new HttpException(
        'Too many auth requests from this IP. Try again shortly.',
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

    return true;
  }

  private clientIp(req: IncomingRequest): string {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.trim()) {
      return xf.split(',')[0]!.trim();
    }
    if (Array.isArray(xf) && xf[0]) {
      return xf[0].split(',')[0]!.trim();
    }
    if (req.ips?.[0]) return req.ips[0];
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}

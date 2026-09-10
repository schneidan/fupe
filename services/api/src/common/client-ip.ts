import type { IncomingMessage } from 'http';

type IpRequest = {
  ip?: string;
  ips?: string[];
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

/** Best-effort client IP behind Cloudflare / nginx proxies. */
export function clientIpFromRequest(req: IpRequest | IncomingMessage): string {
  const headers =
    'headers' in req && req.headers
      ? (req.headers as Record<string, string | string[] | undefined>)
      : {};
  const xf = headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0]!.trim();
  }
  if (Array.isArray(xf) && xf[0]) {
    return xf[0].split(',')[0]!.trim();
  }
  const ips = 'ips' in req ? req.ips : undefined;
  if (ips?.[0]) return ips[0];
  if ('ip' in req && req.ip) return req.ip;
  const socket = 'socket' in req ? req.socket : undefined;
  return socket?.remoteAddress ?? 'unknown';
}

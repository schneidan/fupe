import { NextRequest, NextResponse } from 'next/server';

/** Default: 10 IMAGE proxy requests per IP per rolling hour. */
const LIMIT = Math.max(
  1,
  Number(process.env.IMAGE_LOOKUP_RATE_LIMIT_PER_HOUR ?? 10) || 10,
);
const WINDOW_MS = 60 * 60 * 1000;

const hitsByIp = new Map<string, number[]>();

function isProdLike(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_FUPE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_FUPE_ENV === 'staging'
  );
}

function allowedOrigins(): Set<string> {
  const set = new Set<string>([
    'https://fupe.app',
    'https://www.fupe.app',
    'https://staging.fupe.app',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (site) set.add(site);
  return set;
}

function clientIp(req: NextRequest): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const xff = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (xff) return xff;
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  return 'unknown';
}

function originFromRequest(req: NextRequest): string | null {
  const origin = req.headers.get('origin')?.trim();
  if (origin) return origin.replace(/\/$/, '');
  const referer = req.headers.get('referer')?.trim();
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/** Reject requests that do not appear to come from our web origins. */
export function assertImageLookupOrigin(
  req: NextRequest,
): NextResponse | null {
  const origin = originFromRequest(req);
  const allowed = allowedOrigins();

  if (origin && allowed.has(origin)) return null;

  // Browsers send Origin on cross-origin POST; same-origin may omit it on some
  // paths — still accept when Referer matched. Missing both: only OK in local
  // (non-prod) for curl/smoke tests.
  if (!origin && !isProdLike()) return null;

  return NextResponse.json(
    { message: 'IMAGE lookup blocked: invalid origin' },
    { status: 403 },
  );
}

/** Rolling-window IP throttle for the first-party IMAGE proxy. */
export function assertImageLookupRateLimit(
  req: NextRequest,
): NextResponse | null {
  const ip = clientIp(req);
  const now = Date.now();
  const prev = hitsByIp.get(ip) ?? [];
  const recent = prev.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    return NextResponse.json(
      {
        message: `IMAGE lookup rate limit exceeded (${LIMIT} per hour). Try again later.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': '3600' },
      },
    );
  }
  recent.push(now);
  hitsByIp.set(ip, recent);

  // Occasional cleanup so the map does not grow forever
  if (hitsByIp.size > 10_000) {
    for (const [k, ts] of hitsByIp) {
      const kept = ts.filter((t) => now - t < WINDOW_MS);
      if (!kept.length) hitsByIp.delete(k);
      else hitsByIp.set(k, kept);
    }
  }
  return null;
}

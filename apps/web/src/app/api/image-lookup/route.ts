import { NextRequest, NextResponse } from 'next/server';
import {
  assertImageLookupOrigin,
  assertImageLookupRateLimit,
} from '@/lib/image-lookup-guard';

/**
 * Proxies first-party IMAGE lookup to Nest with X-Fupe-First-Party.
 * Keeps FIRST_PARTY_LOOKUP_SECRET server-side (not in the browser).
 * Tier 2: origin check + IP rate limit before forwarding.
 */
export async function POST(req: NextRequest) {
  const originBlock = assertImageLookupOrigin(req);
  if (originBlock) return originBlock;

  const rateBlock = assertImageLookupRateLimit(req);
  if (rateBlock) return rateBlock;

  const apiUrl = (process.env.API_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  const secret = process.env.FIRST_PARTY_LOOKUP_SECRET?.trim();
  const prodLike =
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_FUPE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_FUPE_ENV === 'staging';

  if (!secret && prodLike) {
    return NextResponse.json(
      { message: 'Image lookup is not configured (missing first-party secret)' },
      { status: 503 },
    );
  }

  const incoming = await req.formData();
  const outbound = new FormData();
  for (const [key, value] of incoming.entries()) {
    outbound.append(key, value);
  }
  if (!outbound.has('type')) {
    outbound.set('type', 'IMAGE');
  }

  const headers: HeadersInit = {};
  if (secret) {
    headers['X-Fupe-First-Party'] = secret;
  }

  const upstream = await fetch(`${apiUrl}/api/v1/lookup`, {
    method: 'POST',
    headers,
    body: outbound,
  });

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      'Content-Type':
        upstream.headers.get('Content-Type') ?? 'application/json',
    },
  });
}

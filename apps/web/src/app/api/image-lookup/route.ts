import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies first-party IMAGE lookup to Nest with X-Fupe-First-Party.
 * Keeps FIRST_PARTY_LOOKUP_SECRET server-side (not in the browser).
 */
export async function POST(req: NextRequest) {
  const apiUrl = (process.env.API_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  const secret = process.env.FIRST_PARTY_LOOKUP_SECRET?.trim();

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

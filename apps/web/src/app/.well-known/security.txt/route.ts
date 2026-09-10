import { resolveSiteUrl } from '@/lib/site-url';

/**
 * RFC 9116 security.txt
 */
export async function GET() {
  const origin = resolveSiteUrl();
  // ~1 year; refresh when rotating contact or policy.
  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);

  const body = [
    'Contact: mailto:security@fupe.app',
    `Expires: ${expires.toISOString()}`,
    `Canonical: ${origin}/.well-known/security.txt`,
    'Preferred-Languages: en',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // CSP A (starter): sensible baseline; styles need unsafe-inline for Next.
    // Scripts keep unsafe-inline for App Router inline bootstraps (tighten later with nonces).
    // Dev-only unsafe-eval: Next Fast Refresh / react-refresh uses eval(); without it
    // client hydration fails and interactive chrome (hamburger, etc.) appears dead.
    const isDev = process.env.NODE_ENV === 'development';
    const fupeEnv = (
      process.env.NEXT_PUBLIC_FUPE_ENV ??
      process.env.FUPE_ENV ??
      ''
    )
      .trim()
      .toLowerCase();
    const searchIndexable =
      fupeEnv === 'production' ||
      fupeEnv === 'prod' ||
      (!fupeEnv && !isDev && process.env.NODE_ENV === 'production');

    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
    const connectSrc = isDev
      ? "connect-src 'self' ws: wss:"
      : "connect-src 'self'";

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      connectSrc,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    /** @type {{ key: string; value: string }[]} */
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(self), microphone=(self), geolocation=()',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
    ];

    // Staging / local: belt-and-suspenders noindex for crawlers that ignore robots.txt.
    if (!searchIndexable) {
      securityHeaders.push({
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow, noarchive',
      });
    }

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/graphql',
        destination: `${apiUrl}/graphql`,
      },
    ];
  },
};

module.exports = nextConfig;

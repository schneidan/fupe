import type { MetadataRoute } from 'next';
import { resolveSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const origin = resolveSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/verify-email',
          '/confirm-email-change',
          '/thanks',
          '/account',
          '/account/',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}

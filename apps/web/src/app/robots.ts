import type { MetadataRoute } from 'next';
import { isSearchIndexable } from '@/lib/fupe-env';
import { resolveSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const origin = resolveSiteUrl();

  // Staging / local: stay out of search indexes entirely.
  if (!isSearchIndexable()) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
    };
  }

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
          '/unsubscribe',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}

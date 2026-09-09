import type { MetadataRoute } from 'next';
import { resolveSiteUrl } from '@/lib/site-url';

async function fetchEntitySlugs(): Promise<string[]> {
  const api = (process.env.API_URL ?? 'http://127.0.0.1:3000').replace(
    /\/$/,
    '',
  );
  const slugs: string[] = [];
  const limit = 100;
  let page = 1;

  // Cap pages so a huge directory cannot stall the sitemap build forever.
  for (let i = 0; i < 200; i++) {
    try {
      const res = await fetch(
        `${api}/api/v1/entities?page=${page}&limit=${limit}`,
        { next: { revalidate: 3600 } },
      );
      if (!res.ok) break;
      const body = (await res.json()) as {
        items?: Array<{ slug?: string; id?: string }>;
        total?: number;
      };
      const items = body.items ?? [];
      for (const item of items) {
        const slug = (item.slug || item.id || '').trim();
        if (slug) slugs.push(slug);
      }
      if (items.length < limit) break;
      if (body.total != null && slugs.length >= body.total) break;
      page += 1;
    } catch {
      break;
    }
  }
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = resolveSiteUrl();
  const now = new Date();

  const staticPaths = [
    '',
    '/browse',
    '/contribute',
    '/contribute/suggest',
    '/contribute/suggest-entity',
    '/contribute/new-entity',
    '/developers',
    '/legal',
    '/legal/privacy',
    '/legal/terms',
    '/legal/contact',
    '/legal/contributor',
    '/legal/api',
    '/legal/sources',
    '/legal/dmca',
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${origin}${path || '/'}`,
    lastModified: now,
    changeFrequency: path === '' || path === '/browse' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path === '/browse' ? 0.9 : 0.6,
  }));

  const entitySlugs = await fetchEntitySlugs();
  const entityEntries: MetadataRoute.Sitemap = entitySlugs.map((slug) => ({
    url: `${origin}/entity/${encodeURIComponent(slug)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticEntries, ...entityEntries];
}

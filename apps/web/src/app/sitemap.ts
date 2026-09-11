import type { MetadataRoute } from 'next';
import { isSearchIndexable } from '@/lib/fupe-env';
import { resolveSiteUrl } from '@/lib/site-url';

/** API list page size (server max is 100). */
const PAGE_SIZE = 100;
/**
 * URLs per child sitemap. Keep well under Google’s 50k limit and small enough
 * that each `/sitemap/[id].xml` finishes inside Next’s ~60s build budget.
 */
const URLS_PER_SITEMAP = 5_000;
const PAGES_PER_SITEMAP = URLS_PER_SITEMAP / PAGE_SIZE;
const FETCH_TIMEOUT_MS = 8_000;
const FETCH_CONCURRENCY = 4;

export const revalidate = 3600;

const STATIC_PATHS = [
  '',
  '/about',
  '/how-it-works',
  '/faq',
  '/pricing',
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
] as const;

function apiBase(): string {
  return (process.env.API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
}

function firstPartyHeaders(): HeadersInit | undefined {
  const secret = process.env.FIRST_PARTY_LOOKUP_SECRET?.trim();
  return secret ? { 'X-Fupe-First-Party': secret } : undefined;
}

async function fetchJson(
  url: string,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: firstPartyHeaders(),
    });
    if (!res.ok) return { ok: false };
    return { ok: true, body: await res.json() };
  } catch {
    return { ok: false };
  }
}

async function fetchEntityTotal(): Promise<number> {
  const result = await fetchJson(
    `${apiBase()}/api/v1/entities?page=1&limit=1`,
  );
  if (!result.ok) return 0;
  const body = result.body as { total?: number };
  return typeof body.total === 'number' && body.total > 0 ? body.total : 0;
}

async function fetchEntityPage(page: number): Promise<string[]> {
  const result = await fetchJson(
    `${apiBase()}/api/v1/entities?page=${page}&limit=${PAGE_SIZE}`,
  );
  if (!result.ok) return [];
  const body = result.body as {
    items?: Array<{ slug?: string; id?: string }>;
  };
  const slugs: string[] = [];
  for (const item of body.items ?? []) {
    const slug = (item.slug || item.id || '').trim();
    if (slug) slugs.push(slug);
  }
  return slugs;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function fetchEntitySlugRange(
  startPage: number,
  pageCount: number,
): Promise<string[]> {
  if (pageCount <= 0) return [];
  const pages = Array.from({ length: pageCount }, (_, i) => startPage + i);
  const batches = await mapPool(pages, FETCH_CONCURRENCY, fetchEntityPage);
  return batches.flat();
}

/**
 * Next serves `/sitemap.xml` as an index of `/sitemap/[id].xml`.
 * id 0 = marketing pages + first entity chunk; later ids = entity chunks only.
 * Non-production builds return an empty sitemap (no indexable URLs).
 */
export async function generateSitemaps() {
  if (!isSearchIndexable()) return [{ id: 0 }];
  const total = await fetchEntityTotal();
  const entitySitemaps = Math.max(1, Math.ceil(total / URLS_PER_SITEMAP));
  return Array.from({ length: entitySitemaps }, (_, id) => ({ id }));
}

export default async function sitemap(props: {
  id: number | string | Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  if (!isSearchIndexable()) return [];

  const rawId = await Promise.resolve(props.id);
  const id = typeof rawId === 'number' ? rawId : Number.parseInt(String(rawId), 10);
  const sitemapId = Number.isFinite(id) && id >= 0 ? id : 0;

  const origin = resolveSiteUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  if (sitemapId === 0) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: `${origin}${path || '/'}`,
        lastModified: now,
        changeFrequency: path === '' || path === '/browse' ? 'daily' : 'weekly',
        priority: path === '' ? 1 : path === '/browse' ? 0.9 : 0.6,
      });
    }
  }

  const startPage = sitemapId * PAGES_PER_SITEMAP + 1;
  const slugs = await fetchEntitySlugRange(startPage, PAGES_PER_SITEMAP);
  for (const slug of slugs) {
    entries.push({
      url: `${origin}/entity/${encodeURIComponent(slug)}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  return entries;
}

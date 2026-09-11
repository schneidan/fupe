import { isSearchIndexable } from '@/lib/fupe-env';
import { resolveSiteUrl } from '@/lib/site-url';

/** API list page size (server max is 100). */
export const PAGE_SIZE = 100;
/** URLs per child sitemap (well under Google’s 50k limit). */
export const URLS_PER_SITEMAP = 5_000;
export const PAGES_PER_SITEMAP = URLS_PER_SITEMAP / PAGE_SIZE;
const FETCH_TIMEOUT_MS = 6_000;
const FETCH_CONCURRENCY = 6;

export const STATIC_PATHS = [
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
      // Runtime sitemap routes — avoid build-time static generation.
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: firstPartyHeaders(),
    });
    if (!res.ok) return { ok: false };
    return { ok: true, body: await res.json() };
  } catch {
    return { ok: false };
  }
}

export async function fetchEntityTotal(): Promise<number> {
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

export async function fetchEntitySlugRange(
  startPage: number,
  pageCount: number,
): Promise<string[]> {
  if (pageCount <= 0) return [];
  const pages = Array.from({ length: pageCount }, (_, i) => startPage + i);
  const batches = await mapPool(pages, FETCH_CONCURRENCY, fetchEntityPage);
  return batches.flat();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

export function emptyUrlsetResponse(): Response {
  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `</urlset>\n`,
  );
}

/** Sitemap index at /sitemap.xml — lists /sitemaps/{id}.xml children. */
export async function buildSitemapIndexXml(): Promise<Response> {
  if (!isSearchIndexable()) return emptyUrlsetResponse();

  const origin = resolveSiteUrl();
  const total = await fetchEntityTotal();
  const chunks = Math.max(1, Math.ceil(total / URLS_PER_SITEMAP));
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ];
  for (let id = 0; id < chunks; id++) {
    lines.push('  <sitemap>');
    lines.push(`    <loc>${escapeXml(`${origin}/sitemaps/${id}.xml`)}</loc>`);
    lines.push('  </sitemap>');
  }
  lines.push('</sitemapindex>');
  return xmlResponse(`${lines.join('\n')}\n`);
}

/**
 * Child sitemap: id 0 = marketing + first entity chunk; later ids = entities only.
 */
export async function buildChildSitemapXml(sitemapId: number): Promise<Response> {
  if (!isSearchIndexable()) return emptyUrlsetResponse();
  if (!Number.isFinite(sitemapId) || sitemapId < 0) {
    return new Response('Not found', { status: 404 });
  }

  const origin = resolveSiteUrl();
  const now = new Date().toISOString();
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ];

  if (sitemapId === 0) {
    for (const path of STATIC_PATHS) {
      const loc = `${origin}${path || '/'}`;
      const priority = path === '' ? '1.0' : path === '/browse' ? '0.9' : '0.6';
      const freq = path === '' || path === '/browse' ? 'daily' : 'weekly';
      lines.push('  <url>');
      lines.push(`    <loc>${escapeXml(loc)}</loc>`);
      lines.push(`    <lastmod>${now}</lastmod>`);
      lines.push(`    <changefreq>${freq}</changefreq>`);
      lines.push(`    <priority>${priority}</priority>`);
      lines.push('  </url>');
    }
  }

  const startPage = sitemapId * PAGES_PER_SITEMAP + 1;
  const slugs = await fetchEntitySlugRange(startPage, PAGES_PER_SITEMAP);
  for (const slug of slugs) {
    const loc = `${origin}/entity/${encodeURIComponent(slug)}`;
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(loc)}</loc>`);
    lines.push(`    <lastmod>${now}</lastmod>`);
    lines.push('    <changefreq>weekly</changefreq>');
    lines.push('    <priority>0.7</priority>');
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return xmlResponse(`${lines.join('\n')}\n`);
}

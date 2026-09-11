import { buildChildSitemapXml } from '@/lib/sitemap-data';

/** On-demand child sitemaps — not generated during `next build`. */
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_req: Request, { params }: RouteParams) {
  const raw = await Promise.resolve(params);
  const id = Number.parseInt(String(raw.id).replace(/\.xml$/i, ''), 10);
  return buildChildSitemapXml(id);
}

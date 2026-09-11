import { buildChildSitemapXml } from '@/lib/sitemap-data';

/** On-demand child sitemaps — not generated during `next build`. */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = Number.parseInt(String(rawId).replace(/\.xml$/i, ''), 10);
  return buildChildSitemapXml(id);
}

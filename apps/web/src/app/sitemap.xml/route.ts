import { buildSitemapIndexXml } from '@/lib/sitemap-data';

/** On-demand sitemap index — not generated during `next build`. */
export const dynamic = 'force-dynamic';

export async function GET() {
  return buildSitemapIndexXml();
}

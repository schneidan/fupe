import { fetchJson } from '../http';
import { normalizeEntity, toSlug } from '../normalize';
import { offCountryTag } from '../regions';
import type {
  IngestOptions,
  NormalizedEdge,
  NormalizedEntity,
  NormalizedProduct,
  SourceBatch,
  SourceCitation,
} from '../types';
import type { IngestSource } from './types';

const SEARCH_URL = 'https://world.openfoodfacts.org/api/v2/search';

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  brands_tags?: string[];
  categories_tags?: string[];
  countries_tags?: string[];
}

interface OffSearchResponse {
  count?: number;
  page?: number;
  page_count?: number;
  page_size?: number;
  products?: OffProduct[];
}

function citationForGtin(gtin: string): SourceCitation {
  return {
    id: `cite-off-${gtin}`,
    url: `https://world.openfoodfacts.org/product/${gtin}`,
    title: `Open Food Facts ${gtin}`,
    retrievedAt: new Date().toISOString(),
  };
}

function brandIdFromName(name: string): string {
  const slug = toSlug(name);
  return slug ? `off-brand-${slug}` : `off-brand-unknown`;
}

function countryCodesFromTags(tags?: string[]): string[] {
  if (!tags?.length) return [];
  const codes: string[] = [];
  for (const tag of tags) {
    // e.g. en:united-states — keep coarse; ISO only when already 2-letter
    const part = tag.split(':').pop() ?? tag;
    if (/^[a-z]{2}$/i.test(part)) codes.push(part.toUpperCase());
  }
  return [...new Set(codes)];
}

/**
 * Open Food Facts product → brand entity batch import.
 * Uses filtered v2 search (unfiltered search is bot-challenged).
 * Paginate with --page / --limit; re-runs MERGE safely for cron backfill.
 */
export const openFoodFactsSource: IngestSource = {
  id: 'open-food-facts',
  implemented: true,

  async fetch(options: IngestOptions): Promise<SourceBatch> {
    const pageSize = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const page = Math.max(options.page ?? 1, 1);
    const countryTag = offCountryTag(options.region);

    const url = new URL(SEARCH_URL);
    url.searchParams.set('fields', 'code,product_name,brands,brands_tags,categories_tags,countries_tags');
    url.searchParams.set('page_size', String(pageSize));
    url.searchParams.set('page', String(page));
    // Category facet required — unfiltered search is often bot-challenged (503).
    url.searchParams.set('categories_tags_en', 'breakfasts');
    if (countryTag) {
      url.searchParams.set('countries_tags_en', countryTag);
    }

    let data: OffSearchResponse;
    try {
      data = await fetchJson<OffSearchResponse>(url.toString(), {}, { retries: 4 });
    } catch (err) {
      // Fallback: drop country filter if OFF rate-limits the combined query
      if (countryTag) {
        url.searchParams.delete('countries_tags_en');
        data = await fetchJson<OffSearchResponse>(url.toString(), {}, { retries: 4 });
      } else {
        throw err;
      }
    }
    const productsRaw = data.products ?? [];

    const entitiesById = new Map<string, NormalizedEntity>();
    const products: NormalizedProduct[] = [];
    const edges: NormalizedEdge[] = [];

    for (const p of productsRaw) {
      const gtin = (p.code ?? '').trim();
      if (!gtin) continue;

      const brandName =
        (p.brands ?? '').split(',')[0]?.trim() ||
        p.brands_tags?.[0]?.replace(/^..:/, '').replace(/-/g, ' ') ||
        undefined;

      let manufacturerEntityId: string | undefined;
      if (brandName) {
        manufacturerEntityId = brandIdFromName(brandName);
        if (!entitiesById.has(manufacturerEntityId)) {
          entitiesById.set(
            manufacturerEntityId,
            normalizeEntity(
              {
                id: manufacturerEntityId,
                name: brandName,
                type: 'BRAND',
                countryCodes: countryCodesFromTags(p.countries_tags),
                sector: 'Consumer Packaged Goods',
                citation: citationForGtin(gtin),
              },
              'open-food-facts',
            ),
          );
        }
      }

      const category =
        p.categories_tags?.[0]?.replace(/^..:/, '').replace(/-/g, ' ') ??
        undefined;

      products.push({
        gtin,
        name: p.product_name?.trim() || brandName || `Product ${gtin}`,
        category,
        manufacturerEntityId,
        source: 'open-food-facts',
        citation: citationForGtin(gtin),
      });

      if (manufacturerEntityId) {
        edges.push({
          fromId: gtin,
          toId: manufacturerEntityId,
          type: 'MANUFACTURED_BY',
          citation: citationForGtin(gtin),
        });
      }
    }

    const pageCount = data.page_count ?? page;
    return {
      entities: [...entitiesById.values()],
      edges,
      products,
      metadata: {
        endpoint: SEARCH_URL,
        region: options.region ?? null,
        page,
        pageSize,
        nextPage: page + 1,
        pageCount,
        totalCount: data.count ?? null,
        rows: productsRaw.length,
        exhausted: page >= pageCount || productsRaw.length === 0,
      },
    };
  },
};

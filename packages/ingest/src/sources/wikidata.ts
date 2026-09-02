import { entityIdFromQid, fetchJson, qidFromUri } from '../http';
import { normalizeEntity } from '../normalize';
import { countryCodesForRegion } from '../regions';
import type {
  EntityType,
  IngestOptions,
  NormalizedEdge,
  NormalizedEntity,
  SourceBatch,
  SourceCitation,
} from '../types';
import type { IngestSource } from './types';

const SPARQL_URL = 'https://query.wikidata.org/sparql';
const WB_API = 'https://www.wikidata.org/w/api.php';

/** Wikidata: private equity firm / venture capital firm */
const Q_PE_FIRM = 'Q5418962';
const Q_VC_FIRM = 'Q3487908';

interface SparqlBinding {
  child: { value: string };
  parent: { value: string };
  countryCode?: { value: string };
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

interface WbEntitiesResponse {
  entities: Record<
    string,
    {
      labels?: Record<string, { value: string }>;
      claims?: Record<
        string,
        Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>
      >;
    }
  >;
}

function citationForQid(qid: string): SourceCitation {
  return {
    id: `cite-wikidata-${qid.toLowerCase()}`,
    url: `https://www.wikidata.org/wiki/${qid}`,
    title: `Wikidata ${qid}`,
    retrievedAt: new Date().toISOString(),
  };
}

function buildOwnershipQuery(
  limit: number,
  offset: number,
  countryCodes: string[] | null,
): string {
  // Keep the graph pattern light — PE/VC typing is done via wbgetentities.
  const countryFilter = countryCodes?.length
    ? `FILTER(?countryCode IN (${countryCodes.map((c) => `"${c}"`).join(', ')}))`
    : '';

  return `
SELECT ?child ?parent ?countryCode WHERE {
  ?child wdt:P749 ?parent .
  OPTIONAL {
    ?child wdt:P17 ?country .
    ?country wdt:P297 ?countryCode .
  }
  ${countryFilter}
}
LIMIT ${limit}
OFFSET ${offset}
`.trim();
}

async function fetchEntityMeta(
  qids: string[],
): Promise<Map<string, { label: string; type: EntityType }>> {
  const out = new Map<string, { label: string; type: EntityType }>();
  const unique = [...new Set(qids)];

  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    const url = new URL(WB_API);
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', chunk.join('|'));
    url.searchParams.set('props', 'labels|claims');
    url.searchParams.set('languages', 'en');
    url.searchParams.set('format', 'json');

    const data = await fetchJson<WbEntitiesResponse>(url.toString());
    for (const [qid, entity] of Object.entries(data.entities ?? {})) {
      const label = entity.labels?.en?.value ?? qid;
      const instanceIds = (entity.claims?.P31 ?? [])
        .map((c) => c.mainsnak?.datavalue?.value?.id)
        .filter((id): id is string => Boolean(id));

      let type: EntityType = 'PARENT_CORP';
      if (instanceIds.includes(Q_PE_FIRM)) type = 'PE_FIRM';
      else if (instanceIds.includes(Q_VC_FIRM)) type = 'VC_FIRM';

      out.set(qid, { label, type });
    }
  }

  return out;
}

/**
 * Wikidata P749 (parent organization) ownership edges.
 * Paginate with --offset / --limit; safe to re-run (MERGE upserts).
 */
export const wikidataSource: IngestSource = {
  id: 'wikidata',
  implemented: true,

  async fetch(options: IngestOptions): Promise<SourceBatch> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);
    const countryCodes = countryCodesForRegion(options.region);

    const query = buildOwnershipQuery(limit, offset, countryCodes);
    const url = new URL(SPARQL_URL);
    url.searchParams.set('query', query);
    url.searchParams.set('format', 'json');

    const sparql = await fetchJson<SparqlResponse>(url.toString(), {
      headers: { Accept: 'application/sparql-results+json' },
    });

    const bindings = sparql.results?.bindings ?? [];
    const qids = new Set<string>();
    for (const row of bindings) {
      qids.add(qidFromUri(row.child.value));
      qids.add(qidFromUri(row.parent.value));
    }

    const meta = await fetchEntityMeta([...qids]);
    const entitiesById = new Map<string, NormalizedEntity>();
    const edges: NormalizedEdge[] = [];

    for (const row of bindings) {
      const childQid = qidFromUri(row.child.value);
      const parentQid = qidFromUri(row.parent.value);
      const childId = entityIdFromQid(childQid);
      const parentId = entityIdFromQid(parentQid);
      const country = row.countryCode?.value
        ? [row.countryCode.value.toUpperCase()]
        : [];

      const childMeta = meta.get(childQid) ?? { label: childQid, type: 'BRAND' as EntityType };
      const parentMeta = meta.get(parentQid) ?? {
        label: parentQid,
        type: 'PARENT_CORP' as EntityType,
      };

      if (!entitiesById.has(childId)) {
        entitiesById.set(
          childId,
          normalizeEntity(
            {
              id: childId,
              name: childMeta.label,
              type: 'BRAND',
              countryCodes: country,
              externalIds: { wikidata: childQid },
              citation: citationForQid(childQid),
            },
            'wikidata',
          ),
        );
      }

      if (!entitiesById.has(parentId)) {
        entitiesById.set(
          parentId,
          normalizeEntity(
            {
              id: parentId,
              name: parentMeta.label,
              type: parentMeta.type,
              countryCodes: [],
              sector:
                parentMeta.type === 'PE_FIRM' || parentMeta.type === 'VC_FIRM'
                  ? 'Private Equity'
                  : undefined,
              externalIds: { wikidata: parentQid },
              citation: citationForQid(parentQid),
            },
            'wikidata',
          ),
        );
      }

      const peOrVc =
        parentMeta.type === 'PE_FIRM' || parentMeta.type === 'VC_FIRM';
      edges.push({
        fromId: childId,
        toId: parentId,
        type: peOrVc ? 'PORTFOLIO_COMPANY_OF' : 'OWNED_BY',
        citation: citationForQid(childQid),
      });
    }

    return {
      entities: [...entitiesById.values()],
      edges,
      products: [],
      metadata: {
        endpoint: SPARQL_URL,
        region: options.region ?? null,
        limit,
        offset,
        nextOffset: offset + limit,
        rows: bindings.length,
        exhausted: bindings.length < limit,
      },
    };
  },
};

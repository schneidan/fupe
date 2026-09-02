/** Shared ETL types for FUPE ingest. */

export type EntityType =
  | 'BRAND'
  | 'SUBSIDIARY'
  | 'PARENT_CORP'
  | 'PE_FIRM'
  | 'VC_FIRM';

export type EdgeType = 'OWNED_BY' | 'PORTFOLIO_COMPANY_OF' | 'MANUFACTURED_BY';

export type SourceId =
  | 'wikidata'
  | 'open-food-facts'
  | 'sec-edgar'
  | 'companies-house'
  | 'opencorporates';

export interface IngestOptions {
  source: SourceId;
  region?: string;
  dryRun?: boolean;
  limit?: number;
  /** Wikidata SPARQL OFFSET (0-based). */
  offset?: number;
  /** Open Food Facts search page (1-based). */
  page?: number;
  databaseUrl?: string;
}

export interface SourceCitation {
  id: string;
  url: string;
  title: string;
  retrievedAt: string;
}

export interface NormalizedEntity {
  /** Stable FUPE id (slug-like). */
  id: string;
  name: string;
  type: EntityType;
  slug: string;
  countryCodes: string[];
  sector?: string;
  aliases?: string[];
  /** External ids for dedupe (Phase 4.3). */
  externalIds?: Record<string, string>;
  source: SourceId;
  citation?: SourceCitation;
}

export interface NormalizedEdge {
  fromId: string;
  toId: string;
  type: EdgeType;
  percentage?: number;
  citation?: SourceCitation;
}

export interface NormalizedProduct {
  gtin: string;
  name: string;
  category?: string;
  manufacturerEntityId?: string;
  source: SourceId;
  citation?: SourceCitation;
}

export interface SourceBatch {
  entities: NormalizedEntity[];
  edges: NormalizedEdge[];
  products: NormalizedProduct[];
  metadata?: Record<string, unknown>;
}

export interface LoadStats {
  entitiesUpserted: number;
  edgesUpserted: number;
  productsUpserted: number;
  citationsUpserted: number;
}

export interface IngestResult {
  source: SourceId;
  region?: string;
  dryRun: boolean;
  runId?: string;
  stats: LoadStats;
  message: string;
}

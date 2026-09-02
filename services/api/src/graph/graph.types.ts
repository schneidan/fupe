export enum EntityType {
  BRAND = 'BRAND',
  SUBSIDIARY = 'SUBSIDIARY',
  PARENT_CORP = 'PARENT_CORP',
  PE_FIRM = 'PE_FIRM',
  VC_FIRM = 'VC_FIRM',
}

export interface EntityProperties {
  id: string;
  name: string;
  type: EntityType;
  slug?: string;
  country_codes?: string[];
  sector?: string;
  aliases?: string[];
  source?: string;
  updated_at?: string;
}

export interface EntitySummary {
  id: string;
  slug: string;
  name: string;
  type: string;
  sector?: string;
  country_codes?: string[];
  is_pe_backed: boolean;
}

export interface EntityDetail extends EntitySummary {
  ownership_chain: ChainNode[];
  citations: Array<{ title: string; url: string }>;
  aliases?: string[];
  source?: string;
  updated_at?: string;
}

export interface RelatedEntitySummary {
  id: string;
  name: string;
  slug: string;
  type: string;
}

export interface RelatedEntities {
  same_ultimate_parent: RelatedEntitySummary[];
  similar_pe_backed: RelatedEntitySummary[];
}

export interface ProductProperties {
  gtin: string;
  name: string;
  category: string;
}

export interface CitationProperties {
  id: string;
  url: string;
  title: string;
}

export interface ChainNode {
  name: string;
  type: EntityType | string;
}

export interface LookupResult {
  matched_item: string;
  entity_id?: string;
  is_private_equity_owned: boolean;
  ultimate_parent: ChainNode | null;
  ownership_chain: ChainNode[];
  citations: Array<{ title: string; url: string }>;
  related?: RelatedEntities;
}

export interface FuzzySearchHit {
  kind: 'entity' | 'product';
  id: string;
  name: string;
  type?: string;
  gtin?: string;
  score: number;
}

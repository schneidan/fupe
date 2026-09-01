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
  is_private_equity_owned: boolean;
  ultimate_parent: ChainNode | null;
  ownership_chain: ChainNode[];
  citations: Array<{ title: string; url: string }>;
}

export interface FuzzySearchHit {
  kind: 'entity' | 'product';
  id: string;
  name: string;
  type?: string;
  gtin?: string;
  score: number;
}

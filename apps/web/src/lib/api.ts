export interface ChainNode {
  name: string;
  type: string;
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

export interface LookupResult {
  matched_item: string;
  entity_id?: string;
  is_private_equity_owned: boolean;
  ultimate_parent: ChainNode | null;
  ownership_chain: ChainNode[];
  citations: Array<{ title: string; url: string }>;
  related?: RelatedEntities;
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

export interface EntityListResponse {
  items: EntitySummary[];
  total: number;
  page: number;
  limit: number;
}

export async function lookup(
  type: 'BARCODE' | 'TEXT' | 'VOICE',
  payload: Record<string, string>,
): Promise<LookupResult> {
  const res = await fetch('/api/v1/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...payload }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { message?: string | string[] }).message ??
      'Lookup failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }

  return res.json();
}

export async function lookupImage(file: File): Promise<LookupResult> {
  const form = new FormData();
  form.append('type', 'IMAGE');
  form.append('file', file);

  const res = await fetch('/api/v1/lookup', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Image lookup failed');
  return res.json();
}

export async function searchHits(q: string) {
  const res = await fetch(`/api/v1/lookup/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  return data.results ?? [];
}

export async function listEntities(params: {
  q?: string;
  type?: string;
  country?: string;
  pe_only?: boolean;
  page?: number;
  limit?: number;
}): Promise<EntityListResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.type) search.set('type', params.type);
  if (params.country) search.set('country', params.country);
  if (params.pe_only) search.set('pe_only', 'true');
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));

  const res = await fetch(`/api/v1/entities?${search.toString()}`);
  if (!res.ok) throw new Error('Failed to load directory');
  return res.json();
}

export async function getEntity(slug: string): Promise<EntityDetail> {
  const res = await fetch(`/api/v1/entities/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Entity not found');
  return res.json();
}

export async function getRelatedEntities(
  slug: string,
): Promise<RelatedEntities> {
  const res = await fetch(
    `/api/v1/entities/${encodeURIComponent(slug)}/related`,
  );
  if (!res.ok) throw new Error('Failed to load related entities');
  return res.json();
}

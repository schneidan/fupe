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

export interface CitationDto {
  title: string;
  url: string;
  retrieved_at?: string;
  stale?: boolean;
}

export interface LookupResult {
  matched_item: string;
  entity_id?: string;
  is_private_equity_owned: boolean;
  ultimate_parent: ChainNode | null;
  ownership_chain: ChainNode[];
  citations: CitationDto[];
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
  citations: CitationDto[];
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

export type EditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProposedEditData {
  entity?: { name?: string; type?: string };
  ownership?: { parent_id?: string; percentage?: number };
  new_parent?: { name: string; type: string };
  create_entity?: {
    name: string;
    type: string;
    sector?: string;
    country_codes?: string[];
  };
}

export interface QueueEdit {
  id: string;
  target_node_id: string;
  proposed_data: ProposedEditData;
  citation_url: string | null;
  status: EditStatus;
  reviewer_id?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  submitter_email?: string;
  submitter_trust?: number;
}

export interface SubmitEditResponse {
  status: 'queued' | 'committed';
  edit?: QueueEdit;
  entity?: unknown;
}

async function authJson<T>(
  path: string,
  init: RequestInit & { token: string },
): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(rest.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Request failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return body as T;
}

export async function submitEdit(
  token: string,
  payload: {
    target_node_id?: string;
    proposed_data: ProposedEditData;
    citation_url: string;
  },
): Promise<SubmitEditResponse> {
  return authJson('/api/v1/edits', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export async function listMyEdits(
  token: string,
  status?: EditStatus,
): Promise<{ edits: QueueEdit[] }> {
  const q = status ? `?status=${status}` : '';
  return authJson(`/api/v1/edits/mine${q}`, { method: 'GET', token });
}

export async function listEditQueue(
  token: string,
): Promise<{ edits: QueueEdit[] }> {
  return authJson('/api/v1/edits/queue', { method: 'GET', token });
}

export async function reviewEdit(
  token: string,
  id: string,
  decision: 'APPROVED' | 'REJECTED',
): Promise<QueueEdit> {
  return authJson(`/api/v1/edits/${encodeURIComponent(id)}/review`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ decision }),
  });
}

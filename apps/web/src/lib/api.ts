export interface ChainNode {
  name: string;
  type: string;
}

export interface LookupResult {
  matched_item: string;
  is_private_equity_owned: boolean;
  ultimate_parent: ChainNode | null;
  ownership_chain: ChainNode[];
  citations: Array<{ title: string; url: string }>;
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

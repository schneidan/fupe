import type { LookupResult } from './api';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function lookupServer(
  type: 'TEXT',
  payload: { query: string },
): Promise<LookupResult> {
  const res = await fetch(`${API_URL}/api/v1/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...payload }),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { message?: string | string[] }).message ?? 'Lookup failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }

  return res.json();
}

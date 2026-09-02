const USER_AGENT = 'FUPE-Ingest/0.1 (local; ownership transparency research)';

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 5;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
          ...(init.headers ?? {}),
        },
      });

      if (res.status === 503 || res.status === 429) {
        const wait = attempt * 2500;
        await new Promise((r) => setTimeout(r, wait));
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `HTTP ${res.status} for ${url}${body ? `: ${body.slice(0, 200)}` : ''}`,
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
        continue;
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

export function qidFromUri(uri: string): string {
  const m = uri.match(/\/(Q\d+)$/i);
  if (!m) throw new Error(`Not a Wikidata entity URI: ${uri}`);
  return m[1].toUpperCase();
}

export function entityIdFromQid(qid: string): string {
  return `wd-${qid.toLowerCase()}`;
}

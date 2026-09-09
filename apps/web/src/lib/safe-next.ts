/**
 * Allow only same-origin relative paths for post-login redirects.
 * Blocks open redirects (`https://evil`, `//evil`, `javascript:`, etc.).
 */
export function safeNextPath(
  raw: string | null | undefined,
  fallback = '/',
): string {
  if (!raw) return fallback;
  const path = raw.trim();
  if (!path) return fallback;

  // Absolute URLs / schemes / protocol-relative
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return fallback;
  if (path.startsWith('//') || path.includes('\\')) return fallback;
  if (!path.startsWith('/')) return fallback;

  try {
    const u = new URL(path, 'https://fupe.invalid');
    if (u.origin !== 'https://fupe.invalid') return fallback;
    const safe = `${u.pathname}${u.search}${u.hash}`;
    if (!safe.startsWith('/') || safe.startsWith('//')) return fallback;
    return safe;
  } catch {
    return fallback;
  }
}

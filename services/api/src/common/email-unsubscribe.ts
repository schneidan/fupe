import { createHmac, timingSafeEqual } from 'crypto';

const UNSUB_TTL_SEC = 90 * 24 * 60 * 60; // 90 days

/**
 * Signed product-email unsubscribe token (userId + expiry + HMAC).
 * Not opaque DB tokens — valid until expiry without a row.
 */
export function signEmailUpdatesUnsubscribeToken(
  userId: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): string {
  const exp = nowSec + UNSUB_TTL_SEC;
  const payload = `${userId}.${exp}`;
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${sig}`, 'utf8').toString('base64url');
}

export function verifyEmailUpdatesUnsubscribeToken(
  token: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): { userId: string } | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const lastDot = raw.lastIndexOf('.');
    if (lastDot <= 0) return null;
    const payload = raw.slice(0, lastDot);
    const sig = raw.slice(lastDot + 1);
    const expected = createHmac('sha256', secret)
      .update(payload)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const [userId, expStr] = payload.split('.');
    const exp = Number(expStr);
    if (!userId || !Number.isFinite(exp) || exp < nowSec) return null;
    return { userId };
  } catch {
    return null;
  }
}

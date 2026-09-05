import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';

const WEAK_JWT_SECRETS = new Set([
  '',
  'fupe-dev-secret-change-me',
  'change-me-in-production',
  'change-me',
  'secret',
]);

/** SHA-256 hex of an opaque email/verify/reset token (store hash, email raw). */
export function hashOpaqueToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function newOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Resolve JWT signing secret. Production refuses missing/weak values.
 * Dev may fall back to a well-known local secret.
 */
export function resolveJwtSecret(
  config: ConfigService | { get(key: string): string | undefined },
): string {
  const raw = (config.get('JWT_SECRET') ?? '').trim();
  const isProd = process.env.NODE_ENV === 'production';
  const weak = WEAK_JWT_SECRETS.has(raw) || raw.length < 16;

  if (isProd && weak) {
    throw new Error(
      'JWT_SECRET must be set to a strong random value (≥16 chars) in production. Refusing to start.',
    );
  }

  return raw || 'fupe-dev-secret-change-me';
}

/** Fail closed on unsafe mail / auto-verify settings in production. */
export function assertProductionAuthSafety(
  config: ConfigService | { get(key: string): string | undefined },
): void {
  if (process.env.NODE_ENV !== 'production') return;

  const provider = (
    config.get('EMAIL_PROVIDER') ??
    ''
  )
    .toLowerCase()
    .trim();
  const hasResend = Boolean(config.get('RESEND_API_KEY')?.trim());
  const hasSmtp = Boolean(config.get('SMTP_HOST')?.trim());

  const effective =
    provider ||
    (hasResend ? 'resend' : hasSmtp ? 'smtp' : 'console');

  if (effective === 'console') {
    throw new Error(
      'EMAIL_PROVIDER=console (or unset with no Resend/SMTP) is not allowed when NODE_ENV=production. Set EMAIL_PROVIDER=resend or smtp.',
    );
  }

  if (config.get('AUTO_VERIFY_EMAIL') === 'true') {
    throw new Error(
      'AUTO_VERIFY_EMAIL=true is not allowed when NODE_ENV=production.',
    );
  }
}

/** Public GraphQL is off in production unless ENABLE_GRAPHQL=true. */
export function isGraphqlEnabled(): boolean {
  return (
    process.env.ENABLE_GRAPHQL === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.ENABLE_GRAPHQL !== 'false')
  );
}

/** Swagger is off in production unless ENABLE_SWAGGER=true. */
export function isSwaggerEnabled(): boolean {
  return (
    process.env.ENABLE_SWAGGER === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.ENABLE_SWAGGER !== 'false')
  );
}

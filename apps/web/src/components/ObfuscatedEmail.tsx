'use client';

/**
 * Renders an email without a raw address in the initial HTML (helps a bit with
 * naive scrapers). Click or keyboard activates a real mailto:.
 */
export function ObfuscatedEmail({
  user,
  domain,
  className = 'text-fupe-text underline decoration-fupe-border underline-offset-2 transition hover:decoration-fupe-muted',
}: {
  user: string;
  domain: string;
  className?: string;
}) {
  const label = `${user} [at] ${domain.replace('.', ' [dot] ')}`;

  function openMail() {
    window.location.href = `mailto:${user}@${domain}`;
  }

  return (
    <button
      type="button"
      onClick={openMail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openMail();
        }
      }}
      className={className}
      title="Click to email"
    >
      {label}
    </button>
  );
}

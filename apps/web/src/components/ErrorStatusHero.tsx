type ErrorStatusTone = 'error' | 'warn';

const TONE: Record<
  ErrorStatusTone,
  { text: string; shadow: string; glow: string }
> = {
  error: {
    text: 'text-status-error',
    shadow: 'shadow-statusError',
    glow: '0 0 80px rgba(234, 88, 12, 0.45)',
  },
  warn: {
    text: 'text-status-warn',
    shadow: 'shadow-statusWarn',
    glow: '0 0 80px rgba(234, 179, 8, 0.4)',
  },
};

interface ErrorStatusHeroProps {
  /** Big glowing code, e.g. "404" or "500" */
  code: string;
  tone?: ErrorStatusTone;
  /** Accessible name for the status (defaults to code) */
  label?: string;
}

/** Same scale/glow treatment as the YES/NO verdict hero, for HTTP-ish statuses. */
export function ErrorStatusHero({
  code,
  tone = 'error',
  label,
}: ErrorStatusHeroProps) {
  const styles = TONE[tone];
  return (
    <p
      className={`font-black leading-none tracking-tight text-7xl sm:text-8xl md:text-9xl ${styles.text} ${styles.shadow}`}
      style={{ textShadow: styles.glow }}
      aria-label={label ?? code}
    >
      {code}
    </p>
  );
}

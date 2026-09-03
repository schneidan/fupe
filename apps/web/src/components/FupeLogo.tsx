import Image from 'next/image';
import Link from 'next/link';

const SIZES = {
  /** Home hero wordmark */
  hero: {
    src: '/brand/logo-horizontal-720.png',
    width: 720,
    height: 167,
    className: 'h-11 w-auto sm:h-14 md:h-16',
  },
  /** Compact back-to-home / inline brand */
  nav: {
    src: '/brand/logo-horizontal-240.png',
    width: 240,
    height: 56,
    className: 'h-3.5 w-auto sm:h-4',
  },
} as const;

type FupeLogoProps = {
  size?: keyof typeof SIZES;
  href?: string | null;
  className?: string;
  /** Prefixed chevron for “back home” chrome */
  back?: boolean;
};

export function FupeLogo({
  size = 'hero',
  href = '/',
  className = '',
  back = false,
}: FupeLogoProps) {
  const cfg = SIZES[size];
  const img = (
    <Image
      src={cfg.src}
      alt="FUPE"
      width={cfg.width}
      height={cfg.height}
      className={`${cfg.className} ${className}`.trim()}
      priority={size === 'hero'}
    />
  );

  const inner = back ? (
    <span className="inline-flex items-center gap-2 text-fupe-muted transition hover:text-fupe-text">
      <span aria-hidden="true" className="text-sm">
        ←
      </span>
      {img}
    </span>
  ) : (
    img
  );

  if (href == null) return inner;

  return (
    <Link href={href} className="inline-block" aria-label="FUPE home">
      {inner}
    </Link>
  );
}

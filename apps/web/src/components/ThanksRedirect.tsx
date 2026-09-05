'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const REDIRECT_SECONDS = 6;

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export function ThanksRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const target = useMemo(
    () => safeNextPath(searchParams.get('next')),
    [searchParams],
  );
  const [left, setLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (left > 0) return;
    router.replace(target);
  }, [left, router, target]);

  return (
    <div className="mt-8 space-y-4 text-center">
      <p className="text-sm text-fupe-muted">
        Taking you back in {left} second{left === 1 ? '' : 's'}…
      </p>
      <p>
        <Link
          href={target}
          className="text-fupe-text underline decoration-fupe-border underline-offset-2 hover:decoration-fupe-muted"
        >
          Continue now
        </Link>
      </p>
    </div>
  );
}

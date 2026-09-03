'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'fupe_cookie_ack';

/**
 * Essential-storage notice. FUPE does not set advertising cookies; we use
 * localStorage for auth. Banner satisfies a light EU consent/notice pattern.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-fupe-border bg-fupe-surface/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-fupe-muted">
          We use essential browser storage to keep you signed in. No ad trackers.
          See our{' '}
          <Link href="/legal/privacy" className="text-fupe-text hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="button"
          className="shrink-0 rounded-full bg-fupe-text px-4 py-1.5 text-xs font-semibold text-fupe-bg hover:bg-fupe-muted"
          onClick={() => {
            try {
              localStorage.setItem(KEY, '1');
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

const LINKS: { href: string; label: string }[] = [
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/faq', label: 'FAQ' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/browse', label: 'Browse' },
  { href: '/contribute', label: 'Contribute' },
  { href: '/developers', label: 'Developers' },
  { href: '/legal', label: 'Legal' },
];

export function SiteNavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  if (
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    pathname === '/register'
  ) {
    return null;
  }

  return (
    <div ref={rootRef} className="fixed left-4 top-4 z-[110]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-fupe-border bg-fupe-surface/90 text-fupe-text backdrop-blur transition hover:border-fupe-muted hover:bg-fupe-elevated"
      >
        <span className="sr-only">{open ? 'Close' : 'Menu'}</span>
        <span aria-hidden className="flex w-4 flex-col gap-1">
          <span
            className={`h-0.5 w-full rounded-full bg-current transition ${
              open ? 'translate-y-1.5 rotate-45' : ''
            }`}
          />
          <span
            className={`h-0.5 w-full rounded-full bg-current transition ${
              open ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`h-0.5 w-full rounded-full bg-current transition ${
              open ? '-translate-y-1.5 -rotate-45' : ''
            }`}
          />
        </span>
      </button>

      {open ? (
        <nav
          id={menuId}
          aria-label="Site"
          className="absolute left-0 top-11 min-w-[12.5rem] rounded-xl border border-fupe-border bg-fupe-surface py-2 shadow-lg"
        >
          <ul>
            {LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== '/' && pathname.startsWith(`${link.href}/`));
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block px-4 py-2 text-sm transition hover:bg-fupe-elevated ${
                      active ? 'text-fupe-text' : 'text-fupe-muted hover:text-fupe-text'
                    }`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

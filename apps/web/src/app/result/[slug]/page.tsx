import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ResultView } from '@/components/ResultView';
import { lookupServer } from '@/lib/lookup-server';
import { slugToQuery } from '@/lib/slug';

type PageProps = {
  params: Promise<{ slug: string }>;
};

function buildResultMetadata(
  matchedItem: string,
  isPe: boolean,
  ultimateParent: string | null,
): Pick<Metadata, 'title' | 'description' | 'openGraph' | 'twitter'> {
  const verdict = isPe ? 'YES' : 'NO';
  const title = `${matchedItem} — PE owned: ${verdict}`;
  const description = isPe
    ? ultimateParent
      ? `${matchedItem} is backed by Private Equity. Ultimate parent: ${ultimateParent}.`
      : `${matchedItem} is backed by Private Equity.`
    : `No PE/VC firm found in the ownership chain for ${matchedItem}.`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = slugToQuery(slug);

  if (!query) {
    return { title: 'FUPE — Is it owned by Private Equity?' };
  }

  try {
    const result = await lookupServer('TEXT', { query });
    return buildResultMetadata(
      result.matched_item,
      result.is_private_equity_owned,
      result.ultimate_parent?.name ?? null,
    );
  } catch {
    const label = query.replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      title: { absolute: `${label} — FUPE` },
      description: `Is ${label} owned by Private Equity? Look up ownership on FUPE.`,
    };
  }
}

export default async function ResultSlugPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-text"
      >
        ← FUPE
      </Link>
      <Suspense
        fallback={
          <div className="py-20 text-center text-fupe-muted">Loading…</div>
        }
      >
        <ResultView slug={slug} />
      </Suspense>
    </main>
  );
}

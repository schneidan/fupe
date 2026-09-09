import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EntityView } from '@/components/EntityView';
import { lookupServer } from '@/lib/lookup-server';
import { slugToQuery } from '@/lib/slug';
import { FupeLogo } from '@/components/FupeLogo';
import { defaultOgImages } from '@/lib/site-url';
import type { LookupResult } from '@/lib/api';

type PageProps = {
  params: Promise<{ slug: string }>;
};

function buildEntityMetadata(
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
      images: [...defaultOgImages],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [defaultOgImages[0].url],
    },
  };
}

async function loadEntity(slug: string): Promise<LookupResult | null> {
  const query = slugToQuery(slug);
  if (!query) return null;
  try {
    return await lookupServer('TEXT', { query });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = slugToQuery(slug);

  if (!query) {
    return { title: 'FUPE — Is it owned by Private Equity?' };
  }

  const result = await loadEntity(slug);
  if (result) {
    return buildEntityMetadata(
      result.matched_item,
      result.is_private_equity_owned,
      result.ultimate_parent?.name ?? null,
    );
  }

  const label = query.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: { absolute: `${label} — FUPE` },
    description: `Is ${label} owned by Private Equity? Look up ownership on FUPE.`,
  };
}

export default async function EntitySlugPage({ params }: PageProps) {
  const { slug } = await params;
  const initialResult = await loadEntity(slug);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <Suspense
        fallback={
          <div className="py-20 text-center text-fupe-muted">Loading…</div>
        }
      >
        <EntityView slug={slug} initialResult={initialResult} />
      </Suspense>
    </main>
  );
}

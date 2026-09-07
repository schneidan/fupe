import { redirect } from 'next/navigation';
import { toSlug } from '@/lib/slug';

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

/** Allow /entity?q=Name → /entity/slug (handy for bookmarks / old links). */
export default async function EntityQueryPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  if (q?.trim()) {
    redirect(`/entity/${toSlug(q.trim())}`);
  }

  redirect('/');
}

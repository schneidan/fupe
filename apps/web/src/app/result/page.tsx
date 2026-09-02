import { redirect } from 'next/navigation';
import { toSlug } from '@/lib/slug';

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

/** Redirect legacy ?q= URLs to clean /result/[slug] paths. */
export default async function ResultLegacyPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  if (q?.trim()) {
    redirect(`/result/${toSlug(q.trim())}`);
  }

  redirect('/');
}

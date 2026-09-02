import Link from 'next/link';
import { EntityDetailView } from '@/components/EntityDetailView';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EntityDetailPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/browse"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-text"
      >
        ← Directory
      </Link>
      <EntityDetailView slug={slug} />
    </main>
  );
}

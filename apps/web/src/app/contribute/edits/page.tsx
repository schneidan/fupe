import Link from 'next/link';
import { MyEditsList } from '@/components/MyEditsList';

export const metadata = {
  title: 'My edits',
};

export default function MyEditsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Link
        href="/contribute"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← Contribute
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-fupe-text">My edits</h1>
      <MyEditsList />
    </main>
  );
}

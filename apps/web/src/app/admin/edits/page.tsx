import Link from 'next/link';
import { AdminEditsQueue } from '@/components/AdminEditsQueue';

export const metadata = {
  title: 'Moderate edits',
};

export default function AdminEditsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Link
        href="/contribute"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← Contribute
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-fupe-text">Edit queue</h1>
      <p className="mb-8 text-sm text-fupe-muted">
        Approve to commit into the graph (+5 trust). Reject (−10 trust).
      </p>
      <AdminEditsQueue />
    </main>
  );
}

import { Suspense } from 'react';
import { AdminShell } from '@/components/AdminShell';

export const metadata = {
  title: {
    default: 'Admin — FUPE',
    template: '%s | Admin — FUPE',
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-fupe-muted">
          Loading…
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

import { AdminNav } from '@/components/AdminNav';

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
    <div className="flex min-h-screen">
      <div className="sticky top-0 h-screen w-52 shrink-0 border-r border-fupe-border bg-fupe-bg px-4 py-8">
        <AdminNav />
      </div>
      <div className="flex-1 overflow-auto px-8 py-8">{children}</div>
    </div>
  );
}

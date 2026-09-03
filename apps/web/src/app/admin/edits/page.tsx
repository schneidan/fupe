import { AdminEditsQueue } from '@/components/AdminEditsQueue';
import { AdminIngestMatchesPanel } from '@/components/AdminIngestMatchesPanel';

export const metadata = { title: 'Contributions' };

/** Legacy URL kept for bookmarks; renders under the new admin layout. */
export default function AdminEditsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fupe-text">Contributions</h1>
        <p className="mt-1 text-sm text-fupe-muted">
          Approve to commit into the graph (+5 trust). Reject (−10 trust).
          Rejected edits can be reopened within 48 hours.
        </p>
      </div>
      <AdminEditsQueue />
      <AdminIngestMatchesPanel />
    </div>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  downloadEmailUpdateSubscribersCsv,
  fetchAdminAudit,
  fetchEmailUpdateSubscribers,
  sendProductUpdate,
  type AdminAuditEntry,
  type EmailUpdateSubscriber,
  type ProductUpdateSendResult,
} from '@/lib/admin-api';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AdminEmailUpdatesPanel() {
  const [items, setItems] = useState<EmailUpdateSubscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendResult, setSendResult] = useState<ProductUpdateSendResult | null>(
    null,
  );
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, a] = await Promise.all([
        fetchEmailUpdateSubscribers({ page, q: q || undefined, limit: 50 }),
        fetchAdminAudit({ limit: 40 }),
      ]);
      setItems(res.subscribers);
      setTotal(res.total);
      setAudit(
        a.entries.filter((e) => e.action.startsWith('email_updates_')).slice(0, 12),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onExportCsv() {
    setCsvBusy(true);
    setError(null);
    try {
      await downloadEmailUpdateSubscribersCsv();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSV export failed');
    } finally {
      setCsvBusy(false);
    }
  }

  async function onSend(e: FormEvent, dryRun: boolean) {
    e.preventDefault();
    if (!dryRun) {
      const ok = window.confirm(
        `Send this update to all ${total} opted-in subscribers? This cannot be undone.`,
      );
      if (!ok) return;
    }
    setSendBusy(true);
    setSendResult(null);
    setError(null);
    try {
      const result = await sendProductUpdate({
        subject: subject.trim(),
        body: body.trim(),
        dry_run: dryRun,
      });
      setSendResult(result);
      if (!dryRun) await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSendBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fupe-text">Email updates</h1>
          <p className="mt-1 text-sm text-fupe-muted">
            {total} opted-in subscriber{total === 1 ? '' : 's'} (active accounts
            only).
          </p>
        </div>
        <button
          type="button"
          disabled={csvBusy}
          onClick={() => void onExportCsv()}
          className="rounded-full border border-fupe-border px-4 py-2 text-sm text-fupe-text hover:border-fupe-muted disabled:opacity-60"
        >
          {csvBusy ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(qDraft.trim());
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          type="search"
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          placeholder="Search email, name, org…"
          className="min-w-[14rem] flex-1 rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text outline-none focus:border-fupe-muted"
        />
        <button
          type="submit"
          className="rounded-full bg-fupe-text px-4 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-fupe-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-fupe-border bg-fupe-elevated text-xs uppercase tracking-wide text-fupe-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Org</th>
              <th className="px-3 py-2 font-medium">Opted in</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-fupe-muted">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-fupe-muted">
                  No opted-in subscribers
                  {q ? ' match that search' : ' yet'}.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-fupe-border/60 last:border-0"
                >
                  <td className="px-3 py-2 text-fupe-text">{s.email}</td>
                  <td className="px-3 py-2 text-fupe-muted">
                    {s.display_name || '—'}
                  </td>
                  <td className="px-3 py-2 text-fupe-muted">
                    {s.organization || '—'}
                  </td>
                  <td className="px-3 py-2 text-fupe-muted">
                    {formatDate(s.email_updates_opt_in_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="flex items-center gap-3 text-sm text-fupe-muted">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>
            Page {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      ) : null}

      <form
        onSubmit={(e) => void onSend(e, false)}
        className="space-y-4 rounded-xl border border-fupe-border bg-fupe-surface p-5"
      >
        <h2 className="font-semibold text-fupe-text">Compose update</h2>
        <p className="text-sm text-fupe-muted">
          Plain text only — blank lines become paragraphs. Prefer a dry run
          first. Sends are audited.
        </p>
        <label className="block text-sm">
          <span className="text-fupe-muted">Subject</span>
          <input
            type="text"
            required
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Major feature: ownership citations"
            className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
          />
        </label>
        <label className="block text-sm">
          <span className="text-fupe-muted">Body</span>
          <textarea
            required
            maxLength={20000}
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What changed, why it matters, and a link if useful…"
            className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={sendBusy || !subject.trim() || !body.trim()}
            onClick={(e) => void onSend(e, true)}
            className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text hover:border-fupe-muted disabled:opacity-60"
          >
            Dry run
          </button>
          <button
            type="submit"
            disabled={sendBusy || !subject.trim() || !body.trim() || total === 0}
            className="rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-60"
          >
            {sendBusy ? 'Working…' : `Send to ${total}`}
          </button>
        </div>
        {sendResult ? (
          <p className="text-sm text-fupe-muted">
            {sendResult.dry_run
              ? `Dry run OK — would send to ${sendResult.total} recipient${sendResult.total === 1 ? '' : 's'}.`
              : `Sent ${sendResult.sent} of ${sendResult.total}${
                  sendResult.failed
                    ? ` (${sendResult.failed} failed)`
                    : ''
                }.`}
          </p>
        ) : null}
      </form>

      {audit.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-fupe-text">Recent sends</h2>
          <ul className="space-y-2 text-sm text-fupe-muted">
            {audit.map((entry) => {
              const state = entry.new_state as {
                subject?: string;
                sent?: number;
                recipient_count?: number;
              } | null;
              return (
                <li key={entry.id}>
                  {formatDate(entry.created_at)} ·{' '}
                  {entry.action === 'email_updates_dry_run' ? 'Dry run · ' : ''}
                  {state?.subject ?? entry.action}
                  {typeof state?.sent === 'number'
                    ? ` · ${state.sent}/${state.recipient_count ?? '?'} sent`
                    : typeof state?.recipient_count === 'number'
                      ? ` · ${state.recipient_count} recipients`
                      : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteEntity,
  getEntity,
  getEntityDependencies,
  previewOwnershipChain,
  updateEntity,
  type EntityDependencies,
  type EntityDetail,
} from '@/lib/api';
import { getStoredUser, getToken } from '@/lib/auth';
import { entityPath } from '@/lib/slug';

const ENTITY_TYPES = [
  { value: 'BRAND', label: 'Brand' },
  { value: 'SUBSIDIARY', label: 'Subsidiary' },
  { value: 'PARENT_CORP', label: 'Parent corporation' },
  { value: 'PE_FIRM', label: 'Private equity firm' },
  { value: 'VC_FIRM', label: 'Venture capital firm' },
] as const;

export function EntityModeratorPanel({
  entityId,
  open,
  onClose,
}: {
  entityId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [deps, setDeps] = useState<EntityDependencies | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('BRAND');
  const [sector, setSector] = useState('');
  const [countries, setCountries] = useState('');
  const [aliases, setAliases] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainEntities, setChainEntities] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [chainConfirm, setChainConfirm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStatus(null);
    setConfirmDelete(false);
    setChainOpen(false);
    setChainEntities([]);
    setChainConfirm('');
    setDeps(null);
    setIsAdmin(getStoredUser()?.role === 'admin');
    setLoading(true);
    const token = getToken();
    Promise.all([
      getEntity(entityId),
      token
        ? getEntityDependencies(token, entityId).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([e, d]) => {
        setDetail(e);
        setDeps(d);
        setName(e.name);
        setType(e.type);
        setSector(e.sector ?? '');
        setCountries((e.country_codes ?? []).join(', '));
        setAliases((e.aliases ?? []).join(', '));
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load entity'),
      )
      .finally(() => setLoading(false));
  }, [open, entityId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (chainOpen) {
          setChainOpen(false);
          return;
        }
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, chainOpen]);

  if (!open) return null;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      setError('Sign in required.');
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const updated = await updateEntity(token, entityId, {
        name: name.trim(),
        type,
        sector: sector.trim(),
        country_codes: countries
          .split(/[\s,]+/)
          .map((c) => c.trim())
          .filter(Boolean),
        aliases: aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
      });
      setDetail(updated);
      setStatus('Saved.');
      const nextSlug = updated.slug || updated.id;
      if (nextSlug) {
        router.replace(entityPath(nextSlug));
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteEntity() {
    const token = getToken();
    if (!token) {
      setError('Sign in required.');
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteEntity(token, entityId, { mode: 'entity' });
      onClose();
      router.push('/browse');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  async function openChainConfirm() {
    const token = getToken();
    if (!token) {
      setError('Sign in required.');
      return;
    }
    setChainLoading(true);
    setError(null);
    setChainConfirm('');
    try {
      const preview = await previewOwnershipChain(token, entityId);
      setChainEntities(
        preview.entities.map((e) => ({ id: e.id, name: e.name })),
      );
      setChainOpen(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load ownership chain',
      );
    } finally {
      setChainLoading(false);
    }
  }

  async function onDeleteChain() {
    const token = getToken();
    if (!token) {
      setError('Sign in required.');
      return;
    }
    if (chainConfirm.trim().toLowerCase() !== 'yes') return;
    setDeleting(true);
    setError(null);
    try {
      await deleteEntity(token, entityId, { mode: 'chain', confirm: 'yes' });
      setChainOpen(false);
      onClose();
      router.push('/browse');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chain delete failed');
      setDeleting(false);
    }
  }

  const hasChildren = (deps?.children.length ?? 0) > 0;
  const hasParents = (deps?.parents.length ?? 0) > 0;
  const hasProducts = (deps?.products.length ?? 0) > 0;
  const hasDeps = hasChildren || hasParents || hasProducts;
  const chainNames = chainEntities.map((e) => e.name);
  const chainLabel =
    chainNames.length <= 8
      ? chainNames.join(', ')
      : `${chainNames.slice(0, 8).join(', ')}, and ${chainNames.length - 8} more`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-fupe-border bg-fupe-bg p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-mod-title"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-fupe-muted">
              Moderator
            </p>
            <h2 id="entity-mod-title" className="mt-1 text-lg font-bold text-fupe-text">
              Edit entity
            </h2>
            {detail && (
              <p className="mt-1 font-mono text-xs text-fupe-accentDim">
                {detail.id}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-fupe-muted hover:text-fupe-text"
          >
            Close
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-fupe-muted">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="flex flex-1 flex-col gap-4">
            <label className="block text-sm">
              <span className="text-fupe-muted">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-elevated px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
              />
            </label>

            <label className="block text-sm">
              <span className="text-fupe-muted">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-elevated px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-fupe-muted">Sector</span>
              <input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="e.g. Restaurants"
                className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-elevated px-3 py-2 text-fupe-text outline-none placeholder:text-fupe-accentDim focus:border-fupe-muted"
              />
            </label>

            <label className="block text-sm">
              <span className="text-fupe-muted">Countries</span>
              <input
                value={countries}
                onChange={(e) => setCountries(e.target.value)}
                placeholder="US, CA"
                className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-elevated px-3 py-2 text-fupe-text outline-none placeholder:text-fupe-accentDim focus:border-fupe-muted"
              />
              <span className="mt-1 block text-xs text-fupe-accentDim">
                Comma-separated ISO codes
              </span>
            </label>

            <label className="block text-sm">
              <span className="text-fupe-muted">Aliases</span>
              <input
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder="Alternate names"
                className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-elevated px-3 py-2 text-fupe-text outline-none placeholder:text-fupe-accentDim focus:border-fupe-muted"
              />
              <span className="mt-1 block text-xs text-fupe-accentDim">
                Comma-separated
              </span>
            </label>

            {error && (
              <p className="text-sm text-status-error" role="alert">
                {error}
              </p>
            )}
            {status && (
              <p className="text-sm text-verdict-no">{status}</p>
            )}

            <button
              type="submit"
              disabled={saving || deleting || !name.trim()}
              className="rounded-lg bg-fupe-text px-4 py-2.5 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>

            <div className="mt-auto border-t border-fupe-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-verdict-yes">
                Danger zone
              </p>
              <p className="mt-2 text-xs text-fupe-muted">
                Deletes remove nodes from the graph and add them to the
                blocklist so ingest will not re-create them. Linked products are
                unlinked, not deleted. Orphaned neighbors stay in the directory
                without the removed ownership edges.
              </p>

              {confirmDelete && hasDeps && (
                <div className="mt-3 space-y-3 rounded-lg border border-verdict-yes/40 bg-verdict-yes/10 p-3 text-xs text-fupe-muted">
                  <p className="font-semibold text-verdict-yes">
                    Reassign before confirming if you care about these links
                  </p>
                  <p>
                    Deleting this entity alone drops ownership edges. Child
                    brands stay but lose this parent. Prefer{' '}
                    <Link
                      href={`/contribute/suggest?entity_id=${encodeURIComponent(entityId)}&name=${encodeURIComponent(detail?.name ?? name)}`}
                      className="text-fupe-text underline underline-offset-2 hover:text-fupe-muted"
                      onClick={onClose}
                    >
                      suggesting an ownership edit
                    </Link>{' '}
                    first.
                  </p>
                  {hasChildren && (
                    <div>
                      <p className="mb-1 text-fupe-text">
                        Children ({deps!.children.length})
                      </p>
                      <ul className="space-y-1">
                        {deps!.children.slice(0, 8).map((c) => (
                          <li key={c.id}>
                            <Link
                              href={entityPath(c.slug)}
                              className="text-fupe-text hover:underline"
                              onClick={onClose}
                            >
                              {c.name}
                            </Link>
                          </li>
                        ))}
                        {deps!.children.length > 8 && (
                          <li>+{deps!.children.length - 8} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {hasParents && (
                    <div>
                      <p className="mb-1 text-fupe-text">
                        Parents ({deps!.parents.length})
                      </p>
                      <ul className="space-y-1">
                        {deps!.parents.map((p) => (
                          <li key={p.id}>
                            <Link
                              href={entityPath(p.slug)}
                              className="text-fupe-text hover:underline"
                              onClick={onClose}
                            >
                              {p.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {hasProducts && (
                    <p>
                      {deps!.products.length} product
                      {deps!.products.length === 1 ? '' : 's'} will be unlinked.
                    </p>
                  )}
                </div>
              )}

              {!confirmDelete && hasDeps && (
                <p className="mt-2 text-xs text-fupe-accentDim">
                  This entity has linked children / parents / products. The first
                  delete click will show them so you can reassign first.
                </p>
              )}

              <button
                type="button"
                disabled={saving || deleting}
                onClick={() => void onDeleteEntity()}
                className={`mt-3 w-full rounded-lg border px-4 py-2.5 text-sm ${
                  confirmDelete
                    ? 'border-verdict-yes bg-verdict-yes/20 font-semibold text-verdict-yes'
                    : 'border-fupe-border text-verdict-yes hover:border-verdict-yes'
                } disabled:opacity-40`}
              >
                {deleting && !chainOpen
                  ? 'Deleting…'
                  : confirmDelete
                    ? 'Click again to confirm delete entity'
                    : 'Delete entity'}
              </button>

              {isAdmin && (
                <>
                  <p className="mt-4 text-xs text-fupe-muted">
                    Ownership-chain delete removes this entity and every parent
                    and child connected through OWNED_BY (the full connected
                    component), each added to the blocklist.
                  </p>
                  <button
                    type="button"
                    disabled={saving || deleting || chainLoading}
                    onClick={() => void openChainConfirm()}
                    className="mt-2 w-full rounded-lg border border-verdict-yes/60 bg-verdict-yes/10 px-4 py-2.5 text-sm font-semibold text-verdict-yes hover:bg-verdict-yes/20 disabled:opacity-40"
                  >
                    {chainLoading ? 'Loading chain…' : 'Delete ownership chain…'}
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </aside>

      {chainOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => !deleting && setChainOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-verdict-yes/50 bg-fupe-bg p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="chain-delete-title"
          >
            <h3
              id="chain-delete-title"
              className="text-lg font-bold text-verdict-yes"
            >
              Delete ownership chain?
            </h3>
            <p className="mt-3 text-sm text-fupe-muted">
              Are you really sure you want to delete{' '}
              <span className="text-fupe-text">{chainLabel}</span>? This cannot
              be undone. Type <span className="font-mono text-fupe-text">yes</span>{' '}
              to confirm.
            </p>
            <ul className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-fupe-border bg-fupe-elevated p-3 text-xs text-fupe-muted">
              {chainEntities.map((e) => (
                <li key={e.id} className="py-0.5">
                  {e.name}
                </li>
              ))}
            </ul>
            <label className="mt-4 block text-sm">
              <span className="text-fupe-muted">Confirmation</span>
              <input
                value={chainConfirm}
                onChange={(e) => setChainConfirm(e.target.value)}
                placeholder="yes"
                autoFocus
                disabled={deleting}
                className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-elevated px-3 py-2 font-mono text-fupe-text outline-none focus:border-verdict-yes"
              />
            </label>
            {error && (
              <p className="mt-2 text-sm text-status-error" role="alert">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setChainOpen(false)}
                className="rounded-lg border border-fupe-border px-4 py-2 text-sm text-fupe-muted hover:text-fupe-text disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deleting || chainConfirm.trim().toLowerCase() !== 'yes'
                }
                onClick={() => void onDeleteChain()}
                className="rounded-lg border border-verdict-yes bg-verdict-yes/20 px-4 py-2 text-sm font-semibold text-verdict-yes disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete chain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

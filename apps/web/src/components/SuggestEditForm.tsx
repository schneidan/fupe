'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  listEntities,
  submitEdit,
  type EntitySummary,
  type ProposedEditData,
} from '@/lib/api';
import { getStoredUser, getToken } from '@/lib/auth';

const PARENT_TYPES = [
  { value: 'PARENT_CORP', label: 'Parent corporation' },
  { value: 'PE_FIRM', label: 'Private equity firm' },
  { value: 'VC_FIRM', label: 'Venture capital firm' },
  { value: 'SUBSIDIARY', label: 'Subsidiary' },
  { value: 'BRAND', label: 'Brand' },
] as const;

type ParentMode = 'existing' | 'new';

export function SuggestEditForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillId = searchParams.get('entity_id') ?? '';
  const prefillName = searchParams.get('name') ?? '';

  const [targetId, setTargetId] = useState(prefillId);
  const [targetName, setTargetName] = useState(prefillName);
  const [parentMode, setParentMode] = useState<ParentMode>('existing');
  const [parentQuery, setParentQuery] = useState('');
  const [parentHits, setParentHits] = useState<EntitySummary[]>([]);
  const [selectedParent, setSelectedParent] = useState<EntitySummary | null>(
    null,
  );
  const [newParentName, setNewParentName] = useState('');
  const [newParentType, setNewParentType] =
    useState<(typeof PARENT_TYPES)[number]['value']>('PARENT_CORP');
  const [percentage, setPercentage] = useState('');
  const [citationUrl, setCitationUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const loginHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('next', `/contribute/suggest?${searchParams.toString()}`);
    return `/login?${params.toString()}`;
  }, [searchParams]);

  useEffect(() => {
    setTargetId(prefillId);
    setTargetName(prefillName);
  }, [prefillId, prefillName]);

  useEffect(() => {
    setSignedIn(Boolean(getToken() && getStoredUser()));
    const onAuth = () =>
      setSignedIn(Boolean(getToken() && getStoredUser()));
    window.addEventListener('fupe-auth', onAuth);
    return () => window.removeEventListener('fupe-auth', onAuth);
  }, []);

  useEffect(() => {
    if (parentMode !== 'existing' || parentQuery.trim().length < 2) {
      setParentHits([]);
      return;
    }
    const handle = setTimeout(() => {
      listEntities({ q: parentQuery.trim(), limit: 8 })
        .then((res) =>
          setParentHits(res.items.filter((i) => i.id !== targetId)),
        )
        .catch(() => setParentHits([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [parentQuery, parentMode, targetId]);

  function buildProposed(): ProposedEditData | null {
    const pct = percentage.trim()
      ? Number(percentage)
      : undefined;
    if (pct != null && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      setError('Ownership % must be between 0 and 100.');
      return null;
    }

    if (parentMode === 'existing') {
      if (!selectedParent) {
        setError('Pick an existing parent from the search results.');
        return null;
      }
      return {
        ownership: {
          parent_id: selectedParent.id,
          ...(pct != null ? { percentage: pct } : {}),
        },
      };
    }

    if (!newParentName.trim()) {
      setError('Enter a name for the new parent.');
      return null;
    }
    return {
      new_parent: {
        name: newParentName.trim(),
        type: newParentType,
      },
      ...(pct != null ? { ownership: { percentage: pct } } : {}),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const token = getToken();
    if (!token || !getStoredUser()) {
      router.push(loginHref);
      return;
    }
    if (!targetId.trim()) {
      setError('Target entity id is required.');
      return;
    }
    if (!citationUrl.trim()) {
      setError('A citation URL is required for ownership suggestions.');
      return;
    }

    const proposed_data = buildProposed();
    if (!proposed_data) return;

    setBusy(true);
    try {
      const result = await submitEdit(token, {
        target_node_id: targetId.trim(),
        proposed_data,
        citation_url: citationUrl.trim(),
      });
      setSuccess(
        result.status === 'committed'
          ? 'Edit committed. Thanks — the graph was updated.'
          : 'Edit submitted for review. Track it on My edits.',
      );
      setTimeout(() => router.push('/contribute/edits'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm text-fupe-muted">Target entity</label>
        <input
          type="text"
          value={targetName}
          onChange={(e) => setTargetName(e.target.value)}
          placeholder="Name (for your reference)"
          className="w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
        />
        <input
          type="text"
          required
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="Entity id"
          className="w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 font-mono text-sm text-fupe-text outline-none focus:border-fupe-muted"
        />
        <p className="text-xs text-fupe-muted">
          Prefills from Suggest an edit. Find ids in the{' '}
          <Link
            href="/browse"
            className="text-fupe-text underline-offset-2 hover:underline"
          >
            directory
          </Link>
          .
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm text-fupe-muted">Proposed parent</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 text-fupe-text">
            <input
              type="radio"
              checked={parentMode === 'existing'}
              onChange={() => setParentMode('existing')}
            />
            Existing entity
          </label>
          <label className="flex items-center gap-2 text-fupe-text">
            <input
              type="radio"
              checked={parentMode === 'new'}
              onChange={() => setParentMode('new')}
            />
            New parent
          </label>
        </div>

        {parentMode === 'existing' ? (
          <div className="space-y-2">
            <input
              type="search"
              value={parentQuery}
              onChange={(e) => {
                setParentQuery(e.target.value);
                setSelectedParent(null);
              }}
              placeholder="Search parent by name…"
              className="w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
            />
            {selectedParent ? (
              <p className="text-sm text-fupe-text">
                Selected:{' '}
                <span className="font-medium">{selectedParent.name}</span>
                <span className="text-fupe-muted">
                  {' '}
                  · {selectedParent.type.replace(/_/g, ' ')}
                </span>
              </p>
            ) : null}
            {parentHits.length > 0 ? (
              <ul className="max-h-48 overflow-auto rounded-lg border border-fupe-border">
                {parentHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedParent(hit);
                        setParentQuery(hit.name);
                        setParentHits([]);
                      }}
                      className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-fupe-elevated"
                    >
                      <span className="text-fupe-text">{hit.name}</span>
                      <span className="shrink-0 text-xs text-fupe-muted">
                        {hit.type.replace(/_/g, ' ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={newParentName}
              onChange={(e) => setNewParentName(e.target.value)}
              placeholder="Parent name"
              className="w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
            />
            <select
              value={newParentType}
              onChange={(e) =>
                setNewParentType(
                  e.target.value as (typeof PARENT_TYPES)[number]['value'],
                )
              }
              className="w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
            >
              {PARENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <label className="block text-sm">
        <span className="text-fupe-muted">Ownership % (optional)</span>
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
        />
      </label>

      <label className="block text-sm">
        <span className="text-fupe-muted">Citation URL (required)</span>
        <input
          type="url"
          required
          value={citationUrl}
          onChange={(e) => setCitationUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
        />
      </label>

      {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}
      {success ? <p className="text-sm text-fupe-text">{success}</p> : null}

      {!signedIn ? (
        <p className="text-sm text-fupe-muted">
          You need an account to submit.{' '}
          <Link
            href={loginHref}
            className="text-fupe-text underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-fupe-text px-6 py-2.5 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-60"
      >
        {busy ? 'Submitting…' : 'Submit suggestion'}
      </button>
    </form>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { lookup, lookupImage } from '@/lib/api';
import { resultPath } from '@/lib/slug';

export function LookupMore() {
  const [open, setOpen] = useState(false);
  const [gtin, setGtin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function goToResult(fn: () => Promise<{ matched_item: string }>) {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      router.push(resultPath(result.matched_item));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  function handleVoice() {
    type SpeechRecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      start: () => void;
    };
    const win = window as unknown as {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = win.webkitSpeechRecognition ?? win.SpeechRecognition;
    if (!SR) {
      setError('Voice search is not supported in this browser.');
      return;
    }
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      router.push(resultPath(transcript));
    };
    recognition.start();
  }

  return (
    <div className="mx-auto mt-14 flex w-full max-w-xl flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 text-base text-fupe-muted transition hover:text-fupe-text"
      >
        {open ? (
          <>
            <span aria-hidden>←</span>
            <span>Hide</span>
          </>
        ) : (
          <>
            <span aria-hidden>→</span>
            <span>More ways to search</span>
            <span className="text-fupe-accentDim">(barcode, voice, photo)</span>
          </>
        )}
      </button>

      {open && (
        <div className="mt-5 w-full space-y-5 rounded-xl border border-fupe-border bg-fupe-surface p-6">
          <div className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              value={gtin}
              onChange={(e) => setGtin(e.target.value)}
              placeholder="GTIN / UPC / EAN"
              className="flex-1 rounded-lg border border-fupe-border bg-fupe-elevated px-4 py-2.5 text-base text-fupe-text outline-none placeholder:text-fupe-accentDim focus:border-fupe-muted"
            />
            <button
              type="button"
              disabled={loading || !gtin.trim()}
              onClick={() =>
                goToResult(() => lookup('BARCODE', { gtin: gtin.trim() }))
              }
              className="rounded-lg bg-fupe-text px-5 py-2.5 text-base font-medium text-fupe-bg hover:bg-fupe-muted disabled:opacity-40"
            >
              Scan
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleVoice}
              className="rounded-lg border border-fupe-border px-5 py-2.5 text-base text-fupe-text hover:border-fupe-muted"
            >
              Voice search
            </button>
            <label className="cursor-pointer rounded-lg border border-fupe-border px-5 py-2.5 text-base text-fupe-text hover:border-fupe-muted">
              Upload packaging photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) goToResult(() => lookupImage(file));
                }}
              />
            </label>
          </div>

          {error && <p className="text-center text-base text-fupe-muted">{error}</p>}
        </div>
      )}
    </div>
  );
}

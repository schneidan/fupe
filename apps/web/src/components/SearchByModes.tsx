'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { lookup, lookupImage, type LookupResult } from '@/lib/api';
import {
  decodeBarcodeFromFile,
  normalizeGtin,
  startBarcodeCamera,
  type BarcodeScanHandle,
} from '@/lib/barcode';
import { resizeImageForLookup } from '@/lib/image';
import { resultPath } from '@/lib/slug';
import { ImageLookupResults } from '@/components/ImageLookupResults';

type Mode = 'IMAGE' | 'BARCODE' | 'VOICE';

const MODES: { id: Mode; label: string }[] = [
  { id: 'IMAGE', label: 'IMAGE' },
  { id: 'BARCODE', label: 'BARCODE' },
  { id: 'VOICE', label: 'VOICE' },
];

export function SearchByModes() {
  /** Controls open/close animation (null = collapsed). */
  const [mode, setMode] = useState<Mode | null>(null);
  /** Content shown inside the panel — kept during close so the collapse animates. */
  const [panelMode, setPanelMode] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [useAi, setUseAi] = useState(true);
  const [multi, setMulti] = useState<{
    interpretation: string;
    results: LookupResult[];
  } | null>(null);

  const [gtin, setGtin] = useState('');
  const [scanning, setScanning] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const barcodePhotoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanHandleRef = useRef<BarcodeScanHandle | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const router = useRouter();
  const panelOpen = mode !== null;

  useEffect(() => {
    return () => {
      scanHandleRef.current?.stop();
      recognitionRef.current?.stop();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (mode) setPanelMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!panelOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePanel();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // closePanel is stable enough via refs; include panelOpen only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  function clearFeedback() {
    setError(null);
    setStatus(null);
  }

  function stopSideEffects() {
    scanHandleRef.current?.stop();
    scanHandleRef.current = null;
    setScanning(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setTranscript('');
  }

  function closePanel() {
    stopSideEffects();
    clearFeedback();
    setMode(null);
  }

  function selectMode(next: Mode) {
    stopSideEffects();
    clearFeedback();
    setMode((m) => (m === next ? null : next));
  }

  function handleImageResult(data: LookupResult) {
    const results =
      data.results && data.results.length > 0 ? data.results : [data];
    const interpretation =
      data.interpretation?.trim() ||
      `“${data.matched_item}”`;

    if (results.length === 1) {
      setMulti(null);
      router.push(resultPath(results[0].matched_item));
      return;
    }

    setMulti({ interpretation, results });
  }

  async function runLookup(fn: () => Promise<LookupResult>, busyMessage: string) {
    setLoading(true);
    clearFeedback();
    setStatus(busyMessage);
    setMulti(null);
    try {
      const data = await fn();
      handleImageResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  async function processImageFile(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    setLoading(true);
    clearFeedback();
    setMulti(null);
    setStatus('Checking for a barcode…');

    try {
      const fromBarcode = await decodeBarcodeFromFile(file);
      if (fromBarcode) {
        setStatus(`Found barcode ${fromBarcode} — looking up…`);
        const data = await lookup('BARCODE', { gtin: fromBarcode });
        handleImageResult({
          ...data,
          interpretation: `a product barcode (${fromBarcode})`,
          results: [data],
        });
        return;
      }

      setStatus(
        useAi
          ? 'Preparing photo…'
          : 'Preparing photo (OCR only)…',
      );
      const prepared = await resizeImageForLookup(file);
      setStatus(
        useAi
          ? 'Looking at your photo…'
          : 'Reading text in your photo…',
      );
      const data = await lookupImage(prepared, { useAi });
      handleImageResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image lookup failed');
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  function onImageInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void processImageFile(file);
  }

  async function submitManualGtin() {
    const normalized = normalizeGtin(gtin);
    if (!normalized) {
      setError('Enter a valid GTIN / UPC / EAN (8–14 digits).');
      return;
    }
    await runLookup(
      () => lookup('BARCODE', { gtin: normalized }),
      `Looking up barcode ${normalized}…`,
    );
  }

  async function onBarcodePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setLoading(true);
    clearFeedback();
    setStatus('Reading barcode from photo…');
    try {
      const decoded = await decodeBarcodeFromFile(file);
      if (!decoded) {
        setError(
          'Could not read a barcode in that photo. Try a clearer close-up, or type the digits.',
        );
        return;
      }
      setGtin(decoded);
      setStatus(`Found ${decoded} — looking up…`);
      const data = await lookup('BARCODE', { gtin: decoded });
      router.push(resultPath(data.matched_item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Barcode lookup failed');
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  async function toggleCameraScan() {
    if (scanning) {
      scanHandleRef.current?.stop();
      scanHandleRef.current = null;
      setScanning(false);
      return;
    }

    clearFeedback();
    setScanning(true);
    // Wait a tick so the video element mounts
    await new Promise((r) => setTimeout(r, 50));
    const video = videoRef.current;
    if (!video) {
      setError('Camera preview failed to start.');
      setScanning(false);
      return;
    }

    try {
      scanHandleRef.current = await startBarcodeCamera(
        video,
        (code) => {
          setScanning(false);
          scanHandleRef.current = null;
          setGtin(code);
          void runLookup(
            () => lookup('BARCODE', { gtin: code }),
            `Looking up barcode ${code}…`,
          );
        },
        (msg) => setError(msg),
      );
    } catch {
      setScanning(false);
    }
  }

  function handleVoice() {
    type SpeechRec = {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: ((event: {
        resultIndex: number;
        results: ArrayLike<{
          isFinal: boolean;
          0: { transcript: string };
        }>;
      }) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    type SpeechRecognitionCtor = new () => SpeechRec;

    const win = window as unknown as {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = win.webkitSpeechRecognition ?? win.SpeechRecognition;
    if (!SR) {
      setError('Voice search is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setListening(false);
      return;
    }

    clearFeedback();
    setTranscript('');
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    setListening(true);

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += piece;
        else interim += piece;
      }
      setTranscript(finalText || interim);
      if (finalText.trim()) {
        setListening(false);
        recognitionRef.current = null;
        router.push(resultPath(finalText.trim()));
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      recognitionRef.current = null;
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied.');
      } else if (event.error !== 'aborted') {
        setError(`Voice error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError('Could not start voice recognition.');
    }
  }

  return (
    <div className="mx-auto mt-12 flex w-full max-w-xl flex-col items-center">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm tracking-wide text-fupe-muted">
        <span className="text-fupe-accentDim">Search by:</span>
        {MODES.map((m, i) => (
          <span key={m.id} className="inline-flex items-center gap-3">
            {i > 0 && (
              <span className="text-fupe-border" aria-hidden>
                ·
              </span>
            )}
            <button
              type="button"
              onClick={() => selectMode(m.id)}
              aria-pressed={mode === m.id}
              className={`font-semibold uppercase tracking-[0.14em] transition ${
                mode === m.id
                  ? 'text-fupe-text underline decoration-fupe-muted underline-offset-4'
                  : 'text-fupe-muted hover:text-fupe-text'
              }`}
            >
              {m.label}
            </button>
          </span>
        ))}
      </div>

      <div
        className={`grid w-full transition-[grid-template-rows] duration-300 ease-out ${
          panelOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          {panelMode && (
            <div className="relative mt-5 w-full space-y-4 border border-fupe-border bg-fupe-surface/80 px-5 py-5 pr-12">
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded text-fupe-muted transition hover:bg-fupe-elevated hover:text-fupe-text"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>

              {panelMode === 'IMAGE' && (
                <>
                  <p className="text-center text-sm text-fupe-muted">
                    Search by image — packaging, logos, storefronts, or signs.
                  </p>
                  {previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="Selected preview"
                      className="mx-auto max-h-40 rounded object-contain"
                    />
                  )}
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => libraryInputRef.current?.click()}
                      className="rounded-lg bg-fupe-text px-5 py-2.5 text-sm font-medium text-fupe-bg hover:bg-fupe-muted disabled:opacity-40"
                    >
                      Choose photo
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => cameraInputRef.current?.click()}
                      className="rounded-lg border border-fupe-border px-5 py-2.5 text-sm text-fupe-text hover:border-fupe-muted disabled:opacity-40"
                    >
                      Use camera
                    </button>
                  </div>
                  <label className="mx-auto flex max-w-md cursor-pointer items-start gap-2.5 text-left text-sm text-fupe-muted">
                    <input
                      type="checkbox"
                      checked={useAi}
                      disabled={loading}
                      onChange={(e) => setUseAi(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-fupe-text"
                    />
                    <span>
                      Use AI vision to identify brands (recommended). Uncheck for
                      on-server text OCR only — weaker for logos and storefronts,
                      but the photo never leaves FUPE.
                    </span>
                  </label>
                  <p className="text-center text-xs leading-relaxed text-fupe-accentDim">
                    {useAi ? (
                      <>
                        With AI on, we send a resized copy of your photo through
                        OpenRouter to a vision model. We configure every request
                        for zero data retention (ZDR) so providers should not
                        store or train on it. We do not keep your photo after the
                        lookup. Details:{' '}
                        <Link
                          href="/legal/privacy"
                          className="text-fupe-muted underline decoration-fupe-border underline-offset-2 hover:text-fupe-text"
                        >
                          Privacy
                        </Link>
                        .
                      </>
                    ) : (
                      <>
                        OCR-only mode runs on our servers. No third-party AI sees
                        this photo. Accuracy is limited to readable printed text.
                        See{' '}
                        <Link
                          href="/legal/privacy"
                          className="text-fupe-muted underline decoration-fupe-border underline-offset-2 hover:text-fupe-text"
                        >
                          Privacy
                        </Link>
                        .
                      </>
                    )}
                  </p>
                  <input
                    ref={libraryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onImageInputChange}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={onImageInputChange}
                  />
                </>
              )}

              {panelMode === 'BARCODE' && (
                <>
                  <p className="text-center text-sm text-fupe-muted">
                    Scan with the camera, upload a barcode photo, or type the digits.
                  </p>
                  {scanning && (
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="mx-auto max-h-56 w-full max-w-sm rounded bg-black object-cover"
                    />
                  )}
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void toggleCameraScan()}
                      className="rounded-lg bg-fupe-text px-5 py-2.5 text-sm font-medium text-fupe-bg hover:bg-fupe-muted disabled:opacity-40"
                    >
                      {scanning ? 'Stop camera' : 'Scan with camera'}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => barcodePhotoRef.current?.click()}
                      className="rounded-lg border border-fupe-border px-5 py-2.5 text-sm text-fupe-text hover:border-fupe-muted disabled:opacity-40"
                    >
                      Photo of barcode
                    </button>
                    <input
                      ref={barcodePhotoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onBarcodePhotoChange}
                    />
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={gtin}
                      onChange={(e) => setGtin(e.target.value)}
                      placeholder="GTIN / UPC / EAN"
                      disabled={loading}
                      className="flex-1 rounded-lg border border-fupe-border bg-fupe-elevated px-4 py-2.5 text-base text-fupe-text outline-none placeholder:text-fupe-accentDim focus:border-fupe-muted disabled:opacity-40"
                    />
                    <button
                      type="button"
                      disabled={loading || !gtin.trim()}
                      onClick={() => void submitManualGtin()}
                      className="rounded-lg border border-fupe-border px-5 py-2.5 text-base font-medium text-fupe-text hover:border-fupe-muted disabled:opacity-40"
                    >
                      Look up
                    </button>
                  </div>
                </>
              )}

              {panelMode === 'VOICE' && (
                <div className="flex flex-col items-center gap-4 py-2">
                  <button
                    type="button"
                    onClick={handleVoice}
                    disabled={loading}
                    aria-pressed={listening}
                    className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition ${
                      listening
                        ? 'border-fupe-text bg-fupe-elevated'
                        : 'border-fupe-border bg-transparent hover:border-fupe-muted'
                    } disabled:opacity-40`}
                  >
                    {listening && (
                      <span
                        className="absolute inset-0 animate-mic-pulse rounded-full border border-fupe-muted"
                        aria-hidden
                      />
                    )}
                    <svg
                      viewBox="0 0 24 24"
                      className="relative h-8 w-8 fill-fupe-text"
                      aria-hidden
                    >
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2z" />
                    </svg>
                    <span className="sr-only">
                      {listening ? 'Stop listening' : 'Start voice search'}
                    </span>
                  </button>
                  <p className="text-sm text-fupe-muted">
                    {listening
                      ? 'Listening… say a brand or company name'
                      : 'Tap the mic, then say a brand or company'}
                  </p>
                  {transcript && (
                    <p className="text-center text-lg text-fupe-text">
                      &ldquo;{transcript}&rdquo;
                    </p>
                  )}
                  <p className="max-w-sm text-center text-xs leading-relaxed text-fupe-accentDim">
                    On the website, speech stays in your browser (Web Speech API).
                    API clients that upload audio use our speech-to-text path with
                    the same ZDR controls — see{' '}
                    <Link
                      href="/legal/privacy"
                      className="text-fupe-muted underline decoration-fupe-border underline-offset-2 hover:text-fupe-text"
                    >
                      Privacy
                    </Link>
                    .
                  </p>
                </div>
              )}

              {(loading || status) && (
                <div className="flex flex-col items-center gap-2 pt-1">
                  {loading && (
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-fupe-muted border-t-transparent" />
                  )}
                  {status && (
                    <p className="text-center text-sm text-fupe-muted">{status}</p>
                  )}
                </div>
              )}

              {error && (
                <p className="text-center text-sm text-verdict-yes" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {multi && (
        <ImageLookupResults
          interpretation={multi.interpretation}
          results={multi.results}
          onDismiss={() => setMulti(null)}
        />
      )}
    </div>
  );
}

/** @deprecated Use SearchByModes */
export { SearchByModes as LookupMore };

'use client';

import { useState } from 'react';

type Tab = 'barcode' | 'voice' | 'packaging';

interface LookupTabsProps {
  onBarcode: (gtin: string) => void;
  onVoice: (transcript: string) => void;
  onImage: (file: File) => void;
}

export function LookupTabs({ onBarcode, onVoice, onImage }: LookupTabsProps) {
  const [tab, setTab] = useState<Tab>('barcode');
  const [gtin, setGtin] = useState('');
  const [listening, setListening] = useState(false);

  function handleVoice() {
    type SpeechRecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
      start: () => void;
    };

    const win = window as unknown as {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    };

    const SpeechRecognition =
      win.webkitSpeechRecognition ?? win.SpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onVoice(transcript);
    };

    recognition.start();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'barcode', label: 'Barcode' },
    { id: 'voice', label: 'Voice' },
    { id: 'packaging', label: 'Packaging' },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? 'bg-white text-fupe-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'barcode' && (
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={gtin}
              onChange={(e) => setGtin(e.target.value)}
              placeholder="Enter GTIN / UPC / EAN"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-fupe-500"
            />
            <button
              type="button"
              onClick={() => gtin && onBarcode(gtin)}
              className="rounded-lg bg-fupe-600 px-4 py-2 text-sm font-medium text-white hover:bg-fupe-700"
            >
              Lookup
            </button>
          </div>
        )}

        {tab === 'voice' && (
          <button
            type="button"
            onClick={handleVoice}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              listening ? 'bg-red-500' : 'bg-fupe-600 hover:bg-fupe-700'
            }`}
          >
            {listening ? 'Listening…' : 'Start voice search'}
          </button>
        )}

        {tab === 'packaging' && (
          <div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="text-sm text-slate-600"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImage(file);
              }}
            />
            <p className="mt-2 text-xs text-slate-500">
              Upload packaging for OCR brand detection.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

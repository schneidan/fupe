interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  loading,
  placeholder = 'Search…',
}: SearchBarProps) {
  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-24 text-base shadow-sm outline-none transition focus:border-fupe-500 focus:ring-2 focus:ring-fupe-500/20"
      />
      <button
        type="submit"
        disabled={loading}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-fupe-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-fupe-700 disabled:opacity-50"
      >
        {loading ? '…' : 'Search'}
      </button>
    </div>
  );
}

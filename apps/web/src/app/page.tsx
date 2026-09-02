import Link from 'next/link';
import { PeSearchForm } from '@/components/PeSearchForm';
import { LookupMore } from '@/components/LookupMore';

export default function HomePage() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="mb-16 text-center">
        <h1 className="text-5xl font-black tracking-tighter text-fupe-text sm:text-6xl md:text-7xl">
          FUPE
        </h1>
      </Link>

      <div className="w-full max-w-2xl text-center">
        <PeSearchForm autoFocus size="home" />
        <LookupMore />
      </div>
    </main>
  );
}

import { PeSearchForm } from '@/components/PeSearchForm';
import { LookupMore } from '@/components/LookupMore';
import { FupeLogo } from '@/components/FupeLogo';

export default function HomePage() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 py-16">
      <div className="mb-16 text-center">
        <FupeLogo size="hero" />
      </div>

      <div className="w-full max-w-2xl text-center">
        <PeSearchForm autoFocus size="home" />
        <LookupMore />
      </div>
    </main>
  );
}

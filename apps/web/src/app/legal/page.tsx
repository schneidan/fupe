import Link from 'next/link';
import { FupeLogo } from '@/components/FupeLogo';

export const metadata = { title: 'Legal' };

const DOCS = [
  { href: '/legal/terms', title: 'Terms of Service', desc: 'Using the FUPE website and apps.' },
  { href: '/legal/privacy', title: 'Privacy Policy', desc: 'What we collect and how we use it (GDPR/CCPA).' },
  { href: '/legal/contributor', title: 'Contributor License', desc: 'Rights you grant when you submit edits.' },
  { href: '/legal/api', title: 'API Terms', desc: 'Rules for API keys and rate limits.' },
  { href: '/legal/sources', title: 'Data Sources & Attribution', desc: 'Where ownership data comes from; ODbL notes.' },
  { href: '/legal/dmca', title: 'DMCA / Takedown', desc: 'How to request removal of content.' },
];

export default function LegalIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="text-2xl font-bold text-fupe-text">Legal</h1>
      <p className="mt-3 text-fupe-muted">
        Policies for FUPE users, contributors, and API customers. These pages are
        product documentation — not a substitute for advice from your own counsel.
      </p>
      <ul className="mt-10 space-y-3">
        {DOCS.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="block rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted"
            >
              <h2 className="font-semibold text-fupe-text">{d.title}</h2>
              <p className="mt-1 text-sm text-fupe-muted">{d.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

import { LegalDoc, LegalH2 } from '@/components/LegalDoc';
import { ObfuscatedEmail } from '@/components/ObfuscatedEmail';

export const metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <LegalDoc title="Contact">
      <p>
        For questions about FUPE, billing, or account access, email support.
        Click the address below to open your mail app (shown obfuscated to
        reduce automated scraping).
      </p>
      <p className="mt-4">
        <ObfuscatedEmail user="support" domain="fupe.app" />
      </p>
      <LegalH2>Other topics</LegalH2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Privacy requests — see the{' '}
          <a href="/legal/privacy" className="text-fupe-text hover:underline">
            Privacy Policy
          </a>
        </li>
        <li>
          Copyright / DMCA — see the{' '}
          <a href="/legal/dmca" className="text-fupe-text hover:underline">
            DMCA page
          </a>
        </li>
        <li>
          API billing &amp; cancellation —{' '}
          <a href="/developers" className="text-fupe-text hover:underline">
            Developers
          </a>{' '}
          or the{' '}
          <a href="/legal/api" className="text-fupe-text hover:underline">
            API Terms
          </a>
        </li>
      </ul>
    </LegalDoc>
  );
}

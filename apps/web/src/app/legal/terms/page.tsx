import { LegalDoc, LegalH2 } from '@/components/LegalDoc';
import { ObfuscatedEmail } from '@/components/ObfuscatedEmail';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service">
      <p>
        These Terms govern your use of FUPE (&quot;Find Ultimate Parent Entity&quot;),
        including the website, mobile apps, and related services operated by{' '}
        <span className="text-fupe-text">FUPE, LLC</span> (together, the
        &quot;Service&quot;). By accessing or using the Service you agree to these
        Terms.
      </p>
      <LegalH2>1. What FUPE is</LegalH2>
      <p>
        FUPE helps you look up whether a brand, product, or company appears to be
        connected to private equity or venture ownership in our citation-backed
        directory. Results are informational only. They are not legal, financial,
        investment, or consumer advice. The Service is offered in early access;
        features and coverage may change.
      </p>
      <LegalH2>2. Accounts</LegalH2>
      <p>
        You may create an account to contribute edits, propose entities, or use
        developer API keys. You are responsible for keeping your credentials
        confidential and for activity under your account. We may suspend or
        disable accounts that abuse the Service or violate these Terms.
      </p>
      <LegalH2>3. Acceptable use</LegalH2>
      <p>
        Do not scrape, overload, or reverse-engineer the Service beyond what the
        documented API allows; do not submit unlawful, defamatory, or knowingly
        false ownership claims; and do not attempt to access other users&apos;
        data. API customers must also follow the{' '}
        <a href="/legal/api" className="text-fupe-text hover:underline">
          API Terms
        </a>
        .
      </p>
      <LegalH2>4. Content &amp; contributions</LegalH2>
      <p>
        Community submissions are governed by the{' '}
        <a href="/legal/contributor" className="text-fupe-text hover:underline">
          Contributor License
        </a>
        . We may review, reject, or reverse edits. Graph commits from approved
        edits become part of the public directory.
      </p>
      <LegalH2>5. Disclaimers</LegalH2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND.
        Ownership chains may be incomplete, outdated, or incorrectly inferred.
        Always verify material decisions with primary sources.
      </p>
      <LegalH2>6. Limitation of liability</LegalH2>
      <p>
        To the fullest extent permitted by law, FUPE, LLC is not liable for
        indirect, incidental, or consequential damages arising from use of the
        Service, or for reliance on lookup results.
      </p>
      <LegalH2>7. Paid plans &amp; voluntary support</LegalH2>
      <p>
        Developer and Pro API subscriptions are billed through Stripe.
        You can cancel or manage billing from the{' '}
        <a href="/developers" className="text-fupe-text hover:underline">
          Developers
        </a>{' '}
        page (Stripe Customer Portal). Cancellation stops renewal at the end of
        the current paid period; you keep access until then. One-time voluntary
        contributions (“keep the lights on”) are non-refundable except where
        required by law or if a charge was made in error — contact support and
        we will make it right.
      </p>
      <LegalH2>8. Governing law</LegalH2>
      <p>
        These Terms are governed by the laws of the State of Colorado, USA,
        without regard to conflict-of-law rules. Courts located in Colorado
        shall have exclusive jurisdiction over disputes arising from these Terms
        or the Service, except where prohibited by applicable consumer-protection
        law.
      </p>
      <LegalH2>9. Changes</LegalH2>
      <p>
        We may update these Terms. Continued use after a change constitutes
        acceptance of the revised Terms. Material changes will be noted by updating
        the date at the top of this page.
      </p>
      <LegalH2>10. Contact</LegalH2>
      <p>
        Operator: FUPE, LLC, 6222 E Pine Lane, Suite 6212 #1098, Parker, CO
        80138, USA.
      </p>
      <p>
        Questions:{' '}
        <ObfuscatedEmail user="support" domain="fupe.app" />{' '}
        or see{' '}
        <a href="/legal/contact" className="text-fupe-text hover:underline">
          Contact
        </a>
        . Legal notices:{' '}
        <ObfuscatedEmail user="legal" domain="fupe.app" />.
      </p>
    </LegalDoc>
  );
}

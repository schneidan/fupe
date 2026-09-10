import { LegalDoc, LegalH2 } from '@/components/LegalDoc';
import { ObfuscatedEmail } from '@/components/ObfuscatedEmail';

export const metadata = { title: 'API Terms' };

export default function ApiTermsPage() {
  return (
    <LegalDoc title="API Terms">
      <p>
        These API Terms apply when you create or use a FUPE API key (`fupe_…`)
        against `/api/v1/*`. They supplement the{' '}
        <a href="/legal/terms" className="text-fupe-text hover:underline">
          Terms of Service
        </a>
        .
      </p>
      <LegalH2>1. Keys &amp; tiers</LegalH2>
      <p>
        Keys are personal to your account. Free, Developer, and Pro tiers have
        different daily rate limits and feature access (for example, image
        lookup requires a paid tier). Do not share keys publicly. Anonymous
        directory browsing is also subject to per-IP daily and burst limits.
      </p>
      <LegalH2>2. Fair use</LegalH2>
      <p>
        Use the API for lawful applications. Do not circumvent rate limits,
        resell raw responses as a competing ownership graph without
        transformation, or use the API to harass individuals. Caching short-lived
        results in your product is fine; republishing the entire directory is not
        without written permission.
      </p>
      <LegalH2>3. Image &amp; voice media</LegalH2>
      <p>
        Image lookups may send a resized image to a third-party vision model via
        OpenRouter unless you pass <code className="text-fupe-text">use_ai=false</code>{' '}
        (on-server OCR only). Voice multipart audio may be transcribed via
        OpenRouter. We request zero data retention (ZDR) on those calls; see the{' '}
        <a href="/legal/privacy" className="text-fupe-text hover:underline">
          Privacy Policy
        </a>
        . Do not upload images or audio that you are not allowed to process.
        Uploads are size-capped (currently 5MB).
      </p>
      <LegalH2>4. Billing, cancellation &amp; refunds</LegalH2>
      <p>
        Paid tiers are billed through Stripe. Cancel anytime from the Developers
        page via the Stripe Customer Portal — access continues through the end of
        the paid period, then the key returns to Free limits. Refunds for unused
        time are not guaranteed but we will correct erroneous charges; email{' '}
        <ObfuscatedEmail user="support" domain="fupe.app" />. Complimentary admin
        overrides are audited and may be revoked.
      </p>
      <LegalH2>5. Attribution</LegalH2>
      <p>
        If you display FUPE ownership verdicts to end users, include a clear
        attribution such as &quot;Ownership data by FUPE&quot; with a link to
        fupe.app (or your production domain) when practical.
      </p>
      <LegalH2>6. Suspension</LegalH2>
      <p>
        We may revoke keys or throttle traffic that threatens Service stability
        or violates these Terms.
      </p>
    </LegalDoc>
  );
}

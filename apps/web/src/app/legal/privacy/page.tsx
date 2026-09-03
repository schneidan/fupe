import { LegalDoc, LegalH2 } from '@/components/LegalDoc';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy">
      <p>
        This Privacy Policy explains how FUPE collects, uses, and shares personal
        information. It is intended to meet GDPR and CCPA transparency expectations
        for a pre-launch / early-access product.
      </p>
      <LegalH2>1. Data we collect</LegalH2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="text-fupe-text">Account data:</span> email address,
          password hash, role, trust score, email verification status, optional
          Stripe customer / subscription identifiers.
        </li>
        <li>
          <span className="text-fupe-text">Contribution data:</span> edit
          proposals, citations you submit, and review metadata.
        </li>
        <li>
          <span className="text-fupe-text">API usage:</span> per-key request
          counts (endpoint, method, status code, timestamp). We do not store
          request bodies or IP addresses in the usage log.
        </li>
        <li>
          <span className="text-fupe-text">Local device storage:</span> JWT and
          user profile in browser/app storage for sign-in. We do not use
          third-party advertising cookies today.
        </li>
      </ul>
      <LegalH2>2. How we use data</LegalH2>
      <p>
        To operate accounts, send verification email, moderate contributions,
        enforce API rate limits, process subscriptions (via Stripe), improve the
        directory, and comply with law.
      </p>
      <LegalH2>3. Legal bases (GDPR)</LegalH2>
      <p>
        Contract (providing the Service you request), legitimate interests
        (security, abuse prevention, product improvement), and consent where
        required (e.g. marketing email if we ever send it — we do not today).
      </p>
      <LegalH2>4. Sharing</LegalH2>
      <p>
        We use processors such as email delivery (SMTP provider), hosting, and
        Stripe for payments. We do not sell personal information. Public
        directory content (entity names, ownership claims, citations) is
        intentionally public.
      </p>
      <LegalH2>5. Retention</LegalH2>
      <p>
        Account data is kept while your account is active. You may request
        export or deletion (Art. 15 / 17) via the in-app account controls or by
        emailing privacy@fupe.app. API usage logs are operational metrics and
        may be retained for a limited period for abuse analysis.
      </p>
      <LegalH2>6. Your rights</LegalH2>
      <p>
        Depending on your region you may access, correct, delete, or export your
        personal data, object to certain processing, or lodge a complaint with a
        supervisory authority. California residents may request disclosure of
        categories collected and opt out of &quot;sale&quot; — we do not sell
        personal information.
      </p>
      <LegalH2>7. Children</LegalH2>
      <p>
        The Service is not directed to children under 16. Do not create an
        account if you are under the applicable age in your jurisdiction.
      </p>
      <LegalH2>8. Contact</LegalH2>
      <p>
        Privacy requests: <span className="text-fupe-text">privacy@fupe.app</span>
      </p>
    </LegalDoc>
  );
}

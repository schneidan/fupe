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
          <span className="text-fupe-text">Lookup inputs (transient):</span>{' '}
          text queries, barcodes, optional photos, and (for API clients) audio
          clips are processed to return an ownership result. We do not keep
          uploaded photos or audio as a gallery or training set after the
          request finishes.
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
        directory, fulfill lookups you request, and comply with law.
      </p>
      <LegalH2>3. Image &amp; voice lookups (AI processors)</LegalH2>
      <p>
        Some lookup modes may use third-party AI so we can recognize brands from
        photos or (for API uploads) transcribe speech. We design these paths for
        minimal data exposure and zero retention where the platform allows it.
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="text-fupe-text">IMAGE (default):</span> a resized
          copy of your photo is sent through{' '}
          <span className="text-fupe-text">OpenRouter</span> to a vision model
          (for example Google Gemini Flash Lite) so we can guess brand or
          company names. On the website you can uncheck &quot;Use AI
          vision&quot; to run <span className="text-fupe-text">on-server OCR
          only</span> (Tesseract). That path never sends the photo to a
          third-party model; it is weaker for logos and storefronts.
        </li>
        <li>
          <span className="text-fupe-text">VOICE on the website:</span> speech
          recognition uses your browser&apos;s Web Speech API. Audio is not
          uploaded to FUPE or OpenRouter for that flow.
        </li>
        <li>
          <span className="text-fupe-text">VOICE via the API:</span> if you
          upload an audio file to our lookup endpoint, we may send it through
          OpenRouter to a speech-to-text model (for example open-weights Whisper
          hosted by an OpenRouter provider). Multipart uploads are size-capped.
        </li>
        <li>
          <span className="text-fupe-text">Barcode-only paths</span> (camera
          scan, typed GTIN, or a barcode detected in a photo) resolve against
          our directory / Open Food Facts without sending the image to a vision
          model.
        </li>
      </ul>
      <p>
        <span className="text-fupe-text">Zero data retention (ZDR):</span> for
        OpenRouter calls we (1) enable ZDR-oriented privacy settings on our
        OpenRouter account where available, and (2) set{' '}
        <code className="text-fupe-text">provider.zdr = true</code> on every
        vision and server speech request so OpenRouter only routes to endpoints
        that advertise a zero-retention policy. OpenRouter documents that ZDR
        providers do not retain prompts/responses for training. We do not opt in
        to OpenRouter prompt logging. FUPE itself does not retain uploaded media
        after the lookup response is returned.
      </p>
      <p>
        These are best-effort contractual and technical controls based on
        OpenRouter&apos;s published policies and routing. We cannot
        independently audit every upstream GPU host. If you need the photo never
        to leave FUPE, use OCR-only IMAGE mode (or avoid IMAGE). Prefer typed
        text or barcode when possible.
      </p>
      <LegalH2>4. Legal bases (GDPR)</LegalH2>
      <p>
        Contract (providing the Service you request), legitimate interests
        (security, abuse prevention, product improvement), and consent where
        required (e.g. marketing email if we ever send it — we do not today).
        Optional AI vision on IMAGE is disclosed in-product; you can decline it
        via the OCR-only control.
      </p>
      <LegalH2>5. Sharing</LegalH2>
      <p>
        We use processors such as email delivery (SMTP / Resend), hosting,
        Stripe for payments, Open Food Facts for barcode product metadata, and —
        when you use AI IMAGE or API VOICE — OpenRouter and the model providers
        it routes to under ZDR constraints described above. We do not sell
        personal information. Public directory content (entity names, ownership
        claims, citations) is intentionally public.
      </p>
      <LegalH2>6. Retention</LegalH2>
      <p>
        Account data is kept while your account is active. You may request
        export or deletion (Art. 15 / 17) via the in-app account controls or by
        emailing privacy@fupe.app. API usage logs are operational metrics and
        may be retained for a limited period for abuse analysis. Lookup media is
        processed in memory for the request and is not stored as user content.
      </p>
      <LegalH2>7. Your rights</LegalH2>
      <p>
        Depending on your region you may access, correct, delete, or export your
        personal data, object to certain processing, or lodge a complaint with a
        supervisory authority. California residents may request disclosure of
        categories collected and opt out of &quot;sale&quot; — we do not sell
        personal information.
      </p>
      <LegalH2>8. Children</LegalH2>
      <p>
        The Service is not directed to children under 16. Do not create an
        account if you are under the applicable age in your jurisdiction.
      </p>
      <LegalH2>9. Contact</LegalH2>
      <p>
        Privacy requests: <span className="text-fupe-text">privacy@fupe.app</span>
      </p>
    </LegalDoc>
  );
}

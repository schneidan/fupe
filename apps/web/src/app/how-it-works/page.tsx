import type { Metadata } from 'next';
import { ContentDoc, ContentH2, ContentLink } from '@/components/ContentDoc';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How FUPE matches a search, traces ownership, and returns a YES or NO for private equity or VC backing.',
};

export default function HowItWorksPage() {
  return (
    <ContentDoc title="How it works">
      <ol className="list-decimal space-y-3 pl-5">
        <li>
          <span className="font-medium text-fupe-text">Search</span> — Type a
          name, scan a barcode, snap a label, or use voice.
        </li>
        <li>
          <span className="font-medium text-fupe-text">Match</span> — We find the
          best entity in our graph (and show alternatives when it&apos;s fuzzy).
        </li>
        <li>
          <span className="font-medium text-fupe-text">Trace</span> — We follow
          ownership links toward the ultimate parent.
        </li>
        <li>
          <span className="font-medium text-fupe-text">Verdict</span> —{' '}
          <span className="font-semibold text-verdict-yes">YES</span> if a PE/VC
          firm appears in that chain;{' '}
          <span className="font-semibold text-verdict-no">NO</span> if we
          don&apos;t find one.
        </li>
        <li>
          <span className="font-medium text-fupe-text">Receipts</span> — Citations
          and the chain stay on the page so you can dig in.
        </li>
      </ol>

      <ContentH2>What YES means</ContentH2>
      <p>
        A private equity or venture firm appears in the ownership path we have
        on file — not that every franchise location or SKU is identical, and not
        a moral scorecard by itself.
      </p>

      <ContentH2>What NO means</ContentH2>
      <p>
        We didn&apos;t find PE/VC in <em>our</em> chain for that match. It might
        still be missing data. Absence of evidence isn&apos;t a guarantee.
      </p>

      <ContentH2>Helping us improve</ContentH2>
      <p>
        Signed-in users can{' '}
        <ContentLink href="/contribute">
          suggest edits and new entities
        </ContentLink>
        . Moderators review before changes go live.
      </p>
    </ContentDoc>
  );
}

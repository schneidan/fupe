import type { Metadata } from 'next';
import { ContentDoc, ContentLink } from '@/components/ContentDoc';

export const metadata: Metadata = {
  title: 'About',
  description:
    'FUPE helps you see whether a brand, product, or company is backed by private equity — with ownership chains and citations.',
};

export default function AboutPage() {
  return (
    <ContentDoc title="About FUPE" deck="Find Ultimate Parent Entity.">
      <p>
        FUPE helps you answer a simple question:{' '}
        <em className="text-fupe-text">is this thing backed by private equity?</em>
      </p>
      <p>
        You search a brand, product barcode, photo, or spoken name. We match it
        in our directory and walk the ownership chain toward the ultimate
        parent. If a PE or VC firm shows up, we say{' '}
        <span className="font-semibold text-verdict-yes">YES</span>. If not,{' '}
        <span className="font-semibold text-verdict-no">NO</span> — with the
        chain and citations either way.
      </p>
      <p>
        We&apos;re in <span className="text-fupe-text">early access</span>.
        Coverage is growing (public records, curated data, and community
        contributions). Results can be incomplete or out-of-date. FUPE is
        informational — not legal, financial, or consumer advice.
      </p>
      <p>
        Operated by <span className="text-fupe-text">FUPE, LLC</span> (Parker,
        Colorado).
      </p>
      <p className="italic">
        Want the graph to get better?{' '}
        <ContentLink href="/contribute">Contribute</ContentLink> an edit or new
        entity. Building something on top? See{' '}
        <ContentLink href="/developers">Developers</ContentLink>.
      </p>
    </ContentDoc>
  );
}

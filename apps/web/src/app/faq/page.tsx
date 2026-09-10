import type { Metadata } from 'next';
import { ContentDoc, ContentH2, ContentLink } from '@/components/ContentDoc';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Common questions about FUPE lookups, data sources, pricing, and accounts.',
};

function FaqItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <ContentH2>{question}</ContentH2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function FaqPage() {
  return (
    <ContentDoc title="FAQ">
      <FaqItem question="Is lookup free?">
        <p>
          Yes. Searching on the site is free. Paid plans are for the{' '}
          <span className="text-fupe-text">API</span> (higher limits, image
          lookup, etc.) — see <ContentLink href="/pricing">Pricing</ContentLink>{' '}
          and <ContentLink href="/developers">Developers</ContentLink>.
        </p>
      </FaqItem>

      <FaqItem question="Do you include venture capital?">
        <p>
          Yes. We treat PE and VC firms as the &quot;financial sponsor&quot;
          signal in the verdict and show one combined YES or NO.
        </p>
      </FaqItem>

      <FaqItem question="Where does the data come from?">
        <p>
          Public records, curated ingestion, and community contributions with
          citations. Details:{' '}
          <ContentLink href="/legal/sources">Sources</ContentLink>.
        </p>
      </FaqItem>

      <FaqItem question="Why might a result be wrong?">
        <p>
          Ownership changes, incomplete filings, name collisions, or a gap in
          our graph. Review the citations for more complete details; suggest a
          fix if you have a better source.
        </p>
      </FaqItem>

      <FaqItem question="Is this legal or investment advice?">
        <p>
          No, absolutely not. This is for informational purposes only.
        </p>
      </FaqItem>

      <FaqItem question="Can I use FUPE in my own app?">
        <p>
          Yes — via the API. Free tier for experimentation; paid Developer and
          Pro tiers for higher limits and image.{' '}
          <ContentLink href="/developers">Developers</ContentLink>
          {' · '}
          <ContentLink href="/legal/api">API Terms</ContentLink>.
        </p>
      </FaqItem>

      <FaqItem question="How do I delete my account?">
        <p>
          Go to{' '}
          <ContentLink href="/account#privacy">
            Account → privacy controls
          </ContentLink>
          . Deletion is immediate with your confirmation. See our{' '}
          <ContentLink href="/legal/privacy">Privacy Policy</ContentLink>.
        </p>
      </FaqItem>

      <FaqItem question="Is FUPE finished?">
        <p>
          No, we are in early access. Features and coverage will change.
        </p>
      </FaqItem>
    </ContentDoc>
  );
}

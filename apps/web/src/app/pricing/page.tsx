import type { Metadata } from 'next';
import { ContentDoc, ContentH2, ContentLink } from '@/components/ContentDoc';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'FUPE web lookups are free. API plans unlock higher limits and image lookup.',
};

export default function PricingPage() {
  return (
    <ContentDoc
      title="Pricing"
      deck="Lookups on the site are free. The API is what you pay for."
    >
      <div className="overflow-x-auto rounded-xl border border-fupe-border">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="border-b border-fupe-border bg-fupe-surface text-fupe-text">
            <tr>
              <th className="px-4 py-3 font-semibold" />
              <th className="px-4 py-3 font-semibold">Web lookup</th>
              <th className="px-4 py-3 font-semibold">API</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fupe-border">
            <tr>
              <th className="px-4 py-3 font-medium text-fupe-text">Cost</th>
              <td className="px-4 py-3">Free</td>
              <td className="px-4 py-3">Free tier + paid plans</td>
            </tr>
            <tr>
              <th className="px-4 py-3 font-medium text-fupe-text">
                What you get
              </th>
              <td className="px-4 py-3">
                Search, browse, entity pages, contribute
              </td>
              <td className="px-4 py-3">
                Programmatic lookup, keys, higher limits
              </td>
            </tr>
            <tr>
              <th className="px-4 py-3 font-medium text-fupe-text">
                Image lookup
              </th>
              <td className="px-4 py-3">
                Available in the app (fair-use limits)
              </td>
              <td className="px-4 py-3">Developer+</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ContentH2>API plans</ContentH2>
      <p>Billed monthly via Stripe; cancel anytime.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-medium text-fupe-text">Free</span> —
          Experimentation limits; good for trying the API.
        </li>
        <li>
          <span className="font-medium text-fupe-text">Developer — $9/mo</span>{' '}
          — Higher limits and image lookup.
        </li>
        <li>
          <span className="font-medium text-fupe-text">Business</span> — Custom
          / contact us (when configured).
        </li>
      </ul>
      <p>
        Full checkout and key management live on{' '}
        <ContentLink href="/developers">Developers</ContentLink>.
      </p>

      <ContentH2>Tips / support</ContentH2>
      <p>
        Optional tips help keep the lights on; they aren&apos;t a subscription
        and don&apos;t unlock API tiers.
      </p>
    </ContentDoc>
  );
}

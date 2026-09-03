import { LegalDoc, LegalH2 } from '@/components/LegalDoc';

export const metadata = { title: 'Contributor License' };

export default function ContributorLicensePage() {
  return (
    <LegalDoc title="Contributor License">
      <p>
        By submitting an edit, new-entity proposal, citation, or other content to
        FUPE (&quot;Contribution&quot;), you agree to this Contributor License.
      </p>
      <LegalH2>1. License grant</LegalH2>
      <p>
        You grant FUPE a worldwide, perpetual, irrevocable, royalty-free,
        sublicensable license to use, reproduce, modify, publish, and distribute
        your Contribution as part of the Service and derived datasets, including
        public display of ownership claims and citations.
      </p>
      <LegalH2>2. Representations</LegalH2>
      <p>
        You represent that you have the right to submit the Contribution, that
        it does not infringe third-party rights, and that citations are accurate
        to the best of your knowledge. Do not submit confidential or personal
        data about others without a lawful basis.
      </p>
      <LegalH2>3. Moderation</LegalH2>
      <p>
        Contributions may be queued for review. Moderators may approve, reject,
        or reopen submissions. Approved graph commits are not automatically undone
        if a later review changes; contact staff for exceptional corrections.
      </p>
      <LegalH2>4. Attribution</LegalH2>
      <p>
        We may credit contributors in internal tools; we do not promise public
        bylines. Your account email is visible to staff reviewing the queue.
      </p>
      <LegalH2>5. Relationship to Terms</LegalH2>
      <p>
        This License supplements the{' '}
        <a href="/legal/terms" className="text-fupe-text hover:underline">
          Terms of Service
        </a>
        . If you do not agree, do not submit Contributions.
      </p>
    </LegalDoc>
  );
}

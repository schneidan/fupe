import { LegalDoc, LegalH2 } from '@/components/LegalDoc';
import { ObfuscatedEmail } from '@/components/ObfuscatedEmail';

export const metadata = { title: 'DMCA / Takedown' };

export default function DmcaPage() {
  return (
    <LegalDoc title="DMCA / Takedown">
      <p>
        FUPE respects intellectual property rights. If you believe content on
        the Service infringes your copyright, send a notice that substantially
        complies with 17 U.S.C. §512(c)(3).
      </p>
      <LegalH2>Designated agent</LegalH2>
      <p>
        DMCA notices for FUPE, LLC may be sent to:
      </p>
      <ul className="list-none space-y-1 pl-0 text-fupe-text">
        <li>FUPE, LLC</li>
        <li>Attn: DMCA Agent</li>
        <li>6222 E Pine Lane, Suite 6212 #1098</li>
        <li>Parker, CO 80138</li>
        <li>
          Email:{' '}
          <ObfuscatedEmail user="dmca" domain="fupe.app" />
        </li>
      </ul>
      <LegalH2>How to submit</LegalH2>
      <p>
        Email{' '}
        <ObfuscatedEmail user="dmca" domain="fupe.app" /> with:
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>Your contact name, address, phone, and email</li>
        <li>Identification of the copyrighted work claimed to be infringed</li>
        <li>
          The URL or entity slug of the material on FUPE you want removed
        </li>
        <li>
          A statement that you have a good-faith belief the use is not
          authorized
        </li>
        <li>
          A statement under penalty of perjury that the information is accurate
          and that you are the owner or authorized to act
        </li>
        <li>Your physical or electronic signature</li>
      </ul>
      <LegalH2>Other takedown requests</LegalH2>
      <p>
        For privacy, defamation, or inaccurate ownership claims that are not
        copyright issues, email{' '}
        <ObfuscatedEmail user="legal" domain="fupe.app" /> with the entity URL
        and supporting evidence. We may correct or annotate entries rather than
        remove public records wholesale.
      </p>
      <LegalH2>Counter-notice</LegalH2>
      <p>
        If your content was removed and you believe it was a mistake, you may
        send a counter-notice under §512(g). We may restore content unless the
        complainant files a court action.
      </p>
    </LegalDoc>
  );
}

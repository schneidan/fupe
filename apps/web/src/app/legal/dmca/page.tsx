import { LegalDoc, LegalH2 } from '@/components/LegalDoc';

export const metadata = { title: 'DMCA / Takedown' };

export default function DmcaPage() {
  return (
    <LegalDoc title="DMCA / Takedown">
      <p>
        FUPE respects intellectual property rights. If you believe content on
        the Service infringes your copyright, send a notice that substantially
        complies with 17 U.S.C. §512(c)(3).
      </p>
      <LegalH2>How to submit</LegalH2>
      <p>
        Email <span className="text-fupe-text">dmca@fupe.app</span> (replace
        with your production address before launch) with:
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
        copyright issues, email <span className="text-fupe-text">legal@fupe.app</span>{' '}
        with the entity URL and supporting evidence. We may correct or annotate
        entries rather than remove public records wholesale.
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

import { LegalDoc, LegalH2 } from '@/components/LegalDoc';

export const metadata = { title: 'Data Sources & Attribution' };

export default function SourcesPage() {
  return (
    <LegalDoc title="Data Sources & Attribution">
      <p>
        FUPE aggregates ownership signals from open data, community edits, and
        (where configured) licensed or public registries. Always treat results as
        a starting point and follow citations to primary sources.
      </p>
      <LegalH2>Primary open sources</LegalH2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="text-fupe-text">Wikidata</span> — structured
          statements under Creative Commons CC0.
        </li>
        <li>
          <span className="text-fupe-text">Open Food Facts</span> — product /
          brand data under the Open Database License (ODbL). If you export or
          redistribute a substantial portion of OFF-derived database content,
          ODbL share-alike obligations may apply to that extract. FUPE lookup
          answers that cite OFF should retain attribution to Open Food Facts.
        </li>
        <li>
          <span className="text-fupe-text">Community contributions</span> —
          moderated edits under the Contributor License.
        </li>
      </ul>
      <LegalH2>ODbL share-alike (Open Food Facts)</LegalH2>
      <p>
        Open Food Facts data is available under ODbL. Using individual product
        lookups inside FUPE does not by itself require you to open-license your
        entire application. If you dump or republish a substantial OFF-derived
        database from FUPE, review ODbL requirements (share-alike for the
        database, attribution) before distribution. See{' '}
        <a
          href="https://opendatacommons.org/licenses/odbl/"
          className="text-fupe-text hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Data Commons ODbL
        </a>{' '}
        and{' '}
        <a
          href="https://world.openfoodfacts.org/data"
          className="text-fupe-text hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Food Facts data
        </a>
        .
      </p>
      <LegalH2>Paid / government sources</LegalH2>
      <p>
        Optional ingest from SEC EDGAR, Companies House, or commercial databases
        may be added later. Those sources will be listed here with their license
        constraints before production use.
      </p>
      <LegalH2>Corrections</LegalH2>
      <p>
        See a bad chain?{' '}
        <a href="/contribute" className="text-fupe-text hover:underline">
          Contribute a correction
        </a>{' '}
        with a public citation, or use the{' '}
        <a href="/legal/dmca" className="text-fupe-text hover:underline">
          DMCA / takedown
        </a>{' '}
        process for infringing content.
      </p>
    </LegalDoc>
  );
}

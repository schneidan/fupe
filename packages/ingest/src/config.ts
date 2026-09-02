import type { IngestOptions, SourceId } from './types';

const DEFAULT_DATABASE_URL =
  'postgresql://fupe:fupe_dev@localhost:5433/fupe';

export const SOURCE_META: Record<
  SourceId,
  { name: string; license: string; attributionUrl: string }
> = {
  wikidata: {
    name: 'Wikidata',
    license: 'CC0',
    attributionUrl: 'https://www.wikidata.org/wiki/Wikidata:Licensing',
  },
  'open-food-facts': {
    name: 'Open Food Facts',
    license: 'ODbL',
    attributionUrl: 'https://world.openfoodfacts.org/data',
  },
  'sec-edgar': {
    name: 'SEC EDGAR',
    license: 'public-domain-US-gov',
    attributionUrl: 'https://www.sec.gov/edgar',
  },
  'companies-house': {
    name: 'UK Companies House',
    license: 'Open Government Licence v3.0',
    attributionUrl: 'https://www.gov.uk/government/organisations/companies-house',
  },
  opencorporates: {
    name: 'OpenCorporates',
    license: 'review-required',
    attributionUrl: 'https://opencorporates.com/',
  },
};

export function resolveDatabaseUrl(override?: string): string {
  return (
    override ??
    process.env.DATABASE_URL ??
    DEFAULT_DATABASE_URL
  );
}

export function parseArgs(argv: string[]): IngestOptions {
  const args = argv.slice(2);
  let source: SourceId | undefined;
  let region: string | undefined;
  let dryRun = false;
  let limit: number | undefined;
  let offset: number | undefined;
  let page: number | undefined;
  let databaseUrl: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--source' || arg === '-s') {
      source = next as SourceId;
      i++;
    } else if (arg === '--region' || arg === '-r') {
      region = next?.toUpperCase();
      i++;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--limit') {
      limit = Number(next);
      i++;
    } else if (arg === '--offset') {
      offset = Number(next);
      i++;
    } else if (arg === '--page') {
      page = Number(next);
      i++;
    } else if (arg === '--database-url') {
      databaseUrl = next;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!source) {
    console.error('Error: --source is required.\n');
    printHelpAndExit(1);
  }

  if (!Object.keys(SOURCE_META).includes(source)) {
    console.error(
      `Error: unknown source "${source}". Valid: ${Object.keys(SOURCE_META).join(', ')}`,
    );
    process.exit(1);
  }

  return { source, region, dryRun, limit, offset, page, databaseUrl };
}

export function printHelpAndExit(code: number): never {
  console.log(`Usage:
  pnpm ingest --source <id> [--region EU|US|GB] [--dry-run] [--limit N] [--offset N] [--page N]

Sources:
  wikidata           Wikidata SPARQL ownership (P749) — paginate with --offset
  open-food-facts    Open Food Facts products — paginate with --page
  sec-edgar          SEC EDGAR (P1 — stub)
  companies-house    UK Companies House (P1 — stub)
  opencorporates     OpenCorporates (P2 — license review)

Cron-friendly: each run upserts a page; advance --offset/--page until metadata.exhausted=true.

Examples:
  pnpm ingest --source wikidata --region US --limit 50 --offset 0
  pnpm ingest --source wikidata --region EU --offset 50 --limit 50
  pnpm ingest --source open-food-facts --region US --page 1 --limit 50 --dry-run
`);
  process.exit(code);
}

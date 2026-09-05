import type { ScheduleOptions } from './scheduler';

export type { ScheduleJob, ScheduleOptions, ScheduleResult, SchedulePageDiff } from './scheduler';
export { runSchedule, DEFAULT_SCHEDULE_JOBS } from './scheduler';
export { getCursor, saveCursor } from './cursors';
export { flagStaleCitations } from './stale';

export function parseScheduleArgs(argv: string[]): ScheduleOptions {
  const args = argv.slice(2);
  const options: ScheduleOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--max-pages') {
      options.maxPages = Number(next);
      i++;
    } else if (arg === '--page-size' || arg === '--limit') {
      options.pageSize = Number(next);
      i++;
    } else if (arg === '--stale-months') {
      options.staleMonths = Number(next);
      i++;
    } else if (arg === '--delay-ms') {
      options.delayMs = Number(next);
      i++;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--database-url') {
      options.databaseUrl = next;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printScheduleHelpAndExit(0);
    }
  }

  return options;
}

export function printScheduleHelpAndExit(code: number): never {
  console.log(`Usage:
  pnpm ingest --schedule [--max-pages N] [--page-size N] [--stale-months N] [--delay-ms N] [--dry-run]

Advances persisted cursors for Wikidata (US/EU), logs entity/citation diffs
per page, then flags citations older than N months.

Open Food Facts is off the default schedule (upstream 401/403/503). Manual:
  pnpm ingest --source open-food-facts --region US --page 1 --limit 25

Defaults are extra-polite for a ~40min cron: max-pages=2, page-size=25, delay-ms=8000.

Examples:
  pnpm ingest:schedule
  pnpm ingest --schedule --dry-run
  pnpm ingest --schedule --max-pages 1 --page-size 25

Cron (every 40 minutes):
  */40 * * * * cd /path/to/fupe && pnpm ingest:schedule
`);
  process.exit(code);
}

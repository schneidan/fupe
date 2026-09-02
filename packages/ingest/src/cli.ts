#!/usr/bin/env tsx
import { parseArgs, printHelpAndExit } from './config';
import { runIngest } from './pipeline';
import {
  parseScheduleArgs,
  printScheduleHelpAndExit,
  runSchedule,
} from './schedule';

function wantsSchedule(argv: string[]): boolean {
  const args = argv.slice(2);
  return args.includes('--schedule') || args[0] === 'schedule';
}

function wantsHelp(argv: string[]): boolean {
  const args = argv.slice(2);
  return args.includes('--help') || args.includes('-h');
}

async function main() {
  if (wantsSchedule(process.argv)) {
    if (wantsHelp(process.argv)) {
      printScheduleHelpAndExit(0);
    }
    const options = parseScheduleArgs(process.argv);
    console.log(
      `FUPE ingest schedule` +
        (options.dryRun ? ' [dry-run]' : '') +
        ` max-pages=${options.maxPages ?? 2}` +
        (options.pageSize != null ? ` page-size=${options.pageSize}` : '') +
        ` delay-ms=${options.delayMs ?? 8000}` +
        ` stale-months=${options.staleMonths ?? 6}`,
    );
    const result = await runSchedule(options);
    console.log(result.message);
    console.log(
      JSON.stringify(
        {
          pages: result.pages.map((p) => ({
            source: p.source,
            region: p.region,
            runId: p.runId,
            deltaEntities: p.entitiesAfter - p.entitiesBefore,
            deltaCitations: p.citationsAfter - p.citationsBefore,
            matched: p.entitiesMatched,
            queued: p.entitiesQueued,
            exhausted: p.exhausted,
          })),
          stale: result.stale,
          errors: result.errors,
        },
        null,
        2,
      ),
    );
    if (result.errors.length) process.exitCode = 1;
    return;
  }

  if (wantsHelp(process.argv) && !process.argv.slice(2).includes('--source')) {
    printHelpAndExit(0);
  }

  const options = parseArgs(process.argv);
  console.log(
    `FUPE ingest — source=${options.source}` +
      (options.region ? ` region=${options.region}` : '') +
      (options.dryRun ? ' [dry-run]' : '') +
      (options.limit != null ? ` limit=${options.limit}` : '') +
      (options.offset != null ? ` offset=${options.offset}` : '') +
      (options.page != null ? ` page=${options.page}` : ''),
  );

  const result = await runIngest(options);
  console.log(result.message);
  console.log(
    JSON.stringify(
      { stats: result.stats, runId: result.runId, cursor: result.cursor },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

#!/usr/bin/env tsx
import { parseArgs } from './config';
import { runIngest } from './pipeline';

async function main() {
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
  console.log(JSON.stringify({ stats: result.stats, runId: result.runId }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

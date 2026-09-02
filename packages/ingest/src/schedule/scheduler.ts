import type { SourceId } from '../types';
import { createPool, withAgeSession, withClient } from '../load';
import { runIngest } from '../pipeline';
import { countCitations, countEntities, getCursor, saveCursor } from './cursors';
import { flagStaleCitations } from './stale';

export interface ScheduleJob {
  source: SourceId;
  region?: string;
  limit?: number;
  /** How this source paginates. */
  cursorKind: 'offset' | 'page';
}

export interface ScheduleOptions {
  jobs?: ScheduleJob[];
  maxPages?: number;
  pageSize?: number;
  staleMonths?: number;
  dryRun?: boolean;
  databaseUrl?: string;
  /** Delay between pages (ms) to be polite to upstream APIs. */
  delayMs?: number;
}

export interface SchedulePageDiff {
  source: SourceId;
  region?: string;
  runId?: string;
  entitiesBefore: number;
  entitiesAfter: number;
  citationsBefore: number;
  citationsAfter: number;
  entitiesUpserted: number;
  entitiesMatched: number;
  entitiesQueued: number;
  exhausted: boolean;
  error?: string;
}

export interface ScheduleResult {
  pages: SchedulePageDiff[];
  stale: { scanned: number; flagged: number; staleMonths: number };
  errors: string[];
  message: string;
}

export const DEFAULT_SCHEDULE_JOBS: ScheduleJob[] = [
  { source: 'wikidata', region: 'US', cursorKind: 'offset', limit: 25 },
  { source: 'wikidata', region: 'EU', cursorKind: 'offset', limit: 25 },
  { source: 'open-food-facts', region: 'US', cursorKind: 'page', limit: 25 },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cron entrypoint: advance cursors for configured sources, log diffs,
 * then flag stale citations. When a source is exhausted, the next run
 * resets the cursor to start a refresh pass.
 *
 * Defaults are intentionally gentle (≈40min cron): 2 pages × 25 rows,
 * 8s between pages, so Wikidata SPARQL and Open Food Facts stay happy.
 */
export async function runSchedule(
  options: ScheduleOptions = {},
): Promise<ScheduleResult> {
  const jobs = options.jobs ?? DEFAULT_SCHEDULE_JOBS;
  // Defaults tuned for a ~40min cron: few pages, long pauses (Wikidata + OFF).
  const maxPages = Math.max(options.maxPages ?? 2, 1);
  const pageSize = options.pageSize;
  const delayMs = options.delayMs ?? 8000;
  const staleMonths = options.staleMonths ?? 6;
  const pages: SchedulePageDiff[] = [];
  const errors: string[] = [];

  const pool = createPool(options.databaseUrl);

  try {
    for (const job of jobs) {
      for (let i = 0; i < maxPages; i++) {
        const label = `${job.source}${job.region ? `/${job.region}` : ''}`;
        try {
          const cursor = await withClient(pool, (client) =>
            getCursor(client, job.source, job.region, job.cursorKind),
          );

          // Exhausted from a prior backfill → start a refresh cycle from the beginning.
          let cursorValue = cursor.cursorValue;
          if (cursor.exhausted) {
            cursorValue = job.cursorKind === 'page' ? 1 : 0;
          }

          const entitiesBefore = await countEntities(pool);
          const citationsBefore = await countCitations(pool);
          const limit = pageSize ?? job.limit ?? 25;

          const result = await runIngest({
            source: job.source,
            region: job.region,
            limit,
            offset: job.cursorKind === 'offset' ? cursorValue : undefined,
            page: job.cursorKind === 'page' ? cursorValue : undefined,
            dryRun: options.dryRun,
            databaseUrl: options.databaseUrl,
          });

          const entitiesAfter = options.dryRun
            ? entitiesBefore
            : await countEntities(pool);
          const citationsAfter = options.dryRun
            ? citationsBefore
            : await countCitations(pool);

          const pageExhausted = result.cursor?.exhausted ?? false;
          const nextValue =
            job.cursorKind === 'offset'
              ? (result.cursor?.nextOffset ?? cursorValue + limit)
              : (result.cursor?.nextPage ?? cursorValue + 1);

          if (!options.dryRun) {
            await withClient(pool, (client) =>
              saveCursor(
                client,
                {
                  sourceId: job.source,
                  region: (job.region ?? '').toUpperCase(),
                  cursorKind: job.cursorKind,
                  cursorValue: pageExhausted
                    ? job.cursorKind === 'page'
                      ? 1
                      : 0
                    : nextValue,
                  exhausted: pageExhausted,
                },
                result.runId,
              ),
            );
          }

          pages.push({
            source: job.source,
            region: job.region,
            runId: result.runId,
            entitiesBefore,
            entitiesAfter,
            citationsBefore,
            citationsAfter,
            entitiesUpserted: result.stats.entitiesUpserted,
            entitiesMatched: result.stats.entitiesMatched,
            entitiesQueued: result.stats.entitiesQueued,
            exhausted: pageExhausted,
          });

          console.log(
            `[schedule] ${label} ` +
              `Δentities=${entitiesAfter - entitiesBefore} ` +
              `Δcitations=${citationsAfter - citationsBefore} ` +
              `matched=${result.stats.entitiesMatched} queued=${result.stats.entitiesQueued} ` +
              (pageExhausted ? 'exhausted' : `next=${nextValue}`),
          );

          if (pageExhausted) break;
          if (i < maxPages - 1 && delayMs > 0) await sleep(delayMs);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const entry = `${label}: ${message}`;
          errors.push(entry);
          pages.push({
            source: job.source,
            region: job.region,
            entitiesBefore: 0,
            entitiesAfter: 0,
            citationsBefore: 0,
            citationsAfter: 0,
            entitiesUpserted: 0,
            entitiesMatched: 0,
            entitiesQueued: 0,
            exhausted: false,
            error: message,
          });
          console.error(`[schedule] ${entry} — skipping remaining pages for this job`);
          break;
        }
      }
    }

    let stale = { scanned: 0, flagged: 0, staleMonths };
    if (!options.dryRun) {
      stale = await withAgeSession(pool, (client) =>
        flagStaleCitations(client, staleMonths),
      );
      console.log(
        `[schedule] stale citations: flagged ${stale.flagged} / scanned ${stale.scanned} (>${staleMonths}mo)`,
      );
    }

    const netEntities = pages.reduce(
      (sum, p) => sum + (p.entitiesAfter - p.entitiesBefore),
      0,
    );

    return {
      pages,
      stale,
      errors,
      message:
        `Schedule complete: ${pages.length} page(s), net +${netEntities} entities, ` +
        `stale flagged ${stale.flagged}` +
        (errors.length ? `, ${errors.length} error(s)` : '') +
        '.',
    };
  } finally {
    await pool.end();
  }
}

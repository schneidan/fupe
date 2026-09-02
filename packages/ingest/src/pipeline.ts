import type { IngestOptions, IngestResult, LoadStats } from './types';
import { getSource } from './sources';
import {
  createPool,
  ensureDataSource,
  finishIngestionRun,
  loadBatch,
  pingDatabase,
  startIngestionRun,
  withAgeSession,
} from './load';

const emptyStats = (): LoadStats => ({
  entitiesUpserted: 0,
  edgesUpserted: 0,
  productsUpserted: 0,
  citationsUpserted: 0,
});

export async function runIngest(options: IngestOptions): Promise<IngestResult> {
  const source = getSource(options.source);
  const batch = await source.fetch(options);

  const recordCount =
    batch.entities.length + batch.edges.length + batch.products.length;

  if (options.dryRun) {
    return {
      source: options.source,
      region: options.region,
      dryRun: true,
      stats: {
        entitiesUpserted: batch.entities.length,
        edgesUpserted: batch.edges.length,
        productsUpserted: batch.products.length,
        citationsUpserted: batch.entities.filter((e) => e.citation).length,
      },
      message: source.implemented
        ? `Dry run: would load ${recordCount} record(s) from ${options.source}`
        : `Dry run: ${options.source} scaffold OK (${String(batch.metadata?.note ?? 'stub')})`,
    };
  }

  const pool = createPool(options.databaseUrl);
  let runId: string | undefined;

  try {
    await pingDatabase(pool);

    return await withAgeSession(pool, async (client) => {
      await ensureDataSource(client, options.source);
      runId = await startIngestionRun(client, options.source, {
        region: options.region ?? null,
        limit: options.limit ?? null,
        offset: options.offset ?? null,
        page: options.page ?? null,
        sourceMetadata: batch.metadata ?? null,
      });

      if (!source.implemented) {
        await finishIngestionRun(client, runId, 'success', 0, {
          skipped: true,
          reason: batch.metadata?.note ?? 'source not implemented',
        });
        return {
          source: options.source,
          region: options.region,
          dryRun: false,
          runId,
          stats: emptyStats(),
          message: `Source "${options.source}" is scaffolded but not implemented yet (Phase 4.2). Recorded empty ingestion_run ${runId}.`,
        };
      }

      try {
        const stats = await loadBatch(client, batch);
        const processed =
          stats.entitiesUpserted +
          stats.edgesUpserted +
          stats.productsUpserted;
        await finishIngestionRun(client, runId, 'success', processed, {
          stats,
          nextOffset: batch.metadata?.nextOffset ?? null,
          nextPage: batch.metadata?.nextPage ?? null,
          exhausted: batch.metadata?.exhausted ?? null,
        });
        const cursorHint =
          batch.metadata?.exhausted === true
            ? ' Source page exhausted.'
            : batch.metadata?.nextOffset != null
              ? ` Next: --offset ${batch.metadata.nextOffset}`
              : batch.metadata?.nextPage != null
                ? ` Next: --page ${batch.metadata.nextPage}`
                : '';
        return {
          source: options.source,
          region: options.region,
          dryRun: false,
          runId,
          stats,
          message: `Loaded ${processed} record(s) from ${options.source} (run ${runId}).${cursorHint}`,
        };
      } catch (err) {
        await finishIngestionRun(client, runId, 'failed', 0, {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    });
  } finally {
    await pool.end();
  }
}

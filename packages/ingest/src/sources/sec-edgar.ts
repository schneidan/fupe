import type { IngestSource } from './types';
import { emptyBatch } from './types';
import type { IngestOptions, SourceBatch } from '../types';

export const secEdgarSource: IngestSource = {
  id: 'sec-edgar',
  implemented: false,

  async fetch(options: IngestOptions): Promise<SourceBatch> {
    return emptyBatch({
      note: 'SEC EDGAR ingest not implemented yet (Phase 4.2 / P1)',
      region: options.region ?? 'US',
      limit: options.limit ?? null,
    });
  },
};

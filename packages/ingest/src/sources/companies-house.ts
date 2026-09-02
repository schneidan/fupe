import type { IngestSource } from './types';
import { emptyBatch } from './types';
import type { IngestOptions, SourceBatch } from '../types';

export const companiesHouseSource: IngestSource = {
  id: 'companies-house',
  implemented: false,

  async fetch(options: IngestOptions): Promise<SourceBatch> {
    return emptyBatch({
      note: 'UK Companies House ingest not implemented yet (Phase 4.2 / P1)',
      region: options.region ?? 'GB',
      limit: options.limit ?? null,
    });
  },
};

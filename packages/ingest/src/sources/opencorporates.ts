import type { IngestSource } from './types';
import { emptyBatch } from './types';
import type { IngestOptions, SourceBatch } from '../types';

export const openCorporatesSource: IngestSource = {
  id: 'opencorporates',
  implemented: false,

  async fetch(options: IngestOptions): Promise<SourceBatch> {
    return emptyBatch({
      note: 'OpenCorporates ingest blocked pending license review (Phase 4.2 / P2)',
      region: options.region ?? null,
      limit: options.limit ?? null,
    });
  },
};

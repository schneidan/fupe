import type { IngestOptions, SourceBatch } from '../types';

export interface IngestSource {
  readonly id: string;
  readonly implemented: boolean;
  fetch(options: IngestOptions): Promise<SourceBatch>;
}

export function emptyBatch(
  metadata?: Record<string, unknown>,
): SourceBatch {
  return {
    entities: [],
    edges: [],
    products: [],
    metadata,
  };
}

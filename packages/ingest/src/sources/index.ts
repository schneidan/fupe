import type { SourceId } from '../types';
import type { IngestSource } from './types';
import { wikidataSource } from './wikidata';
import { openFoodFactsSource } from './open-food-facts';
import { secEdgarSource } from './sec-edgar';
import { companiesHouseSource } from './companies-house';

const registry: Record<SourceId, IngestSource> = {
  wikidata: wikidataSource,
  'open-food-facts': openFoodFactsSource,
  'sec-edgar': secEdgarSource,
  'companies-house': companiesHouseSource,
};

export function getSource(id: SourceId): IngestSource {
  const source = registry[id];
  if (!source) {
    throw new Error(`Unknown source: ${id}`);
  }
  return source;
}

export function listSources(): SourceId[] {
  return Object.keys(registry) as SourceId[];
}

export type { IngestSource } from './types';
export { emptyBatch } from './types';

import { toSlug, normalizeCountryCode, trimCollapse } from './name';
import type {
  EntityType,
  NormalizedEntity,
  SourceCitation,
  SourceId,
} from '../types';

export interface DraftEntity {
  name: string;
  type: EntityType;
  countryCodes?: string[];
  sector?: string;
  aliases?: string[];
  externalIds?: Record<string, string>;
  id?: string;
  citation?: SourceCitation;
}

export function normalizeEntity(
  draft: DraftEntity,
  source: SourceId,
): NormalizedEntity {
  const name = trimCollapse(draft.name);
  if (!name) {
    throw new Error('Entity name is required');
  }

  const id = draft.id ?? toSlug(name);
  const slug = toSlug(draft.name) || id;

  return {
    id,
    name,
    type: draft.type,
    slug,
    countryCodes: (draft.countryCodes ?? []).map(normalizeCountryCode),
    sector: draft.sector ? trimCollapse(draft.sector) : undefined,
    aliases: draft.aliases?.map(trimCollapse).filter(Boolean),
    externalIds: draft.externalIds,
    source,
    citation: draft.citation,
  };
}

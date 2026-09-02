import type { PoolClient } from 'pg';
import { enqueueMatchReview, resolveEntityMatch } from '../match';
import type {
  LoadStats,
  NormalizedEdge,
  NormalizedEntity,
  NormalizedProduct,
  SourceBatch,
} from '../types';
import { runCypherWrite } from './client';

export interface LoadOptions {
  ingestionRunId?: string;
  /** When true, skip fuzzy/external matching (always MERGE by incoming id). */
  skipDedupe?: boolean;
}

export async function loadBatch(
  client: PoolClient,
  batch: SourceBatch,
  options: LoadOptions = {},
): Promise<LoadStats> {
  const stats: LoadStats = {
    entitiesUpserted: 0,
    edgesUpserted: 0,
    productsUpserted: 0,
    citationsUpserted: 0,
    entitiesMatched: 0,
    entitiesQueued: 0,
  };

  /** Remap incoming entity ids → canonical graph ids after dedupe. */
  const idMap = new Map<string, string>();

  for (const entity of batch.entities) {
    let target = entity;

    if (!options.skipDedupe) {
      const decision = await resolveEntityMatch(client, entity);
      if (decision.kind === 'auto') {
        idMap.set(entity.id, decision.entityId);
        target = { ...entity, id: decision.entityId };
        stats.entitiesMatched++;
      } else if (decision.kind === 'review') {
        await enqueueMatchReview(client, {
          incoming: entity,
          candidateEntityId: decision.entityId,
          candidateName: decision.candidateName,
          score: decision.score,
          reason: decision.reason,
          sourceId: entity.source,
          ingestionRunId: options.ingestionRunId,
        });
        stats.entitiesQueued++;
        // Still insert as its own node; reviewer can merge later.
        idMap.set(entity.id, entity.id);
      } else {
        idMap.set(entity.id, entity.id);
      }
    } else {
      idMap.set(entity.id, entity.id);
    }

    await upsertEntity(client, target);
    stats.entitiesUpserted++;
    if (target.citation) {
      await upsertCitation(client, target.id, target.citation);
      stats.citationsUpserted++;
    }
  }

  for (const edge of batch.edges) {
    const remapped: NormalizedEdge = {
      ...edge,
      fromId: idMap.get(edge.fromId) ?? edge.fromId,
      toId: idMap.get(edge.toId) ?? edge.toId,
    };
    await upsertEdge(client, remapped);
    stats.edgesUpserted++;
    if (remapped.citation && remapped.type !== 'MANUFACTURED_BY') {
      await upsertCitation(client, remapped.fromId, remapped.citation);
      stats.citationsUpserted++;
    }
  }

  for (const product of batch.products) {
    const remapped: NormalizedProduct = {
      ...product,
      manufacturerEntityId: product.manufacturerEntityId
        ? (idMap.get(product.manufacturerEntityId) ??
          product.manufacturerEntityId)
        : undefined,
    };
    await upsertProduct(client, remapped);
    stats.productsUpserted++;
  }

  return stats;
}

async function upsertEntity(
  client: PoolClient,
  entity: NormalizedEntity,
): Promise<void> {
  const countryJson = JSON.stringify(entity.countryCodes);
  const aliasesJson = entity.aliases ? JSON.stringify(entity.aliases) : null;
  const externalIdsJson = entity.externalIds
    ? JSON.stringify(entity.externalIds)
    : null;
  const updatedAt = new Date().toISOString().slice(0, 10);

  await runCypherWrite(
    client,
    `
      MERGE (e:Entity {id: $id})
      SET
        e.name = $name,
        e.type = $type,
        e.slug = $slug,
        e.country_codes = $countryCodes,
        e.sector = $sector,
        e.aliases = $aliases,
        e.external_ids = $externalIds,
        e.source = $source,
        e.updated_at = $updatedAt
      RETURN e
    `,
    {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      slug: entity.slug,
      countryCodes: countryJson,
      sector: entity.sector ?? null,
      aliases: aliasesJson,
      externalIds: externalIdsJson,
      source: entity.source,
      updatedAt,
    },
  );
}

async function upsertEdge(
  client: PoolClient,
  edge: NormalizedEdge,
): Promise<void> {
  if (edge.type === 'MANUFACTURED_BY') {
    await runCypherWrite(
      client,
      `
        MATCH (p:Product {gtin: $fromId}), (e:Entity {id: $toId})
        MERGE (p)-[:MANUFACTURED_BY]->(e)
        RETURN p
      `,
      { fromId: edge.fromId, toId: edge.toId },
    );
    return;
  }

  const rel =
    edge.type === 'PORTFOLIO_COMPANY_OF' ? 'PORTFOLIO_COMPANY_OF' : 'OWNED_BY';

  if (edge.percentage != null) {
    await runCypherWrite(
      client,
      `
        MATCH (child:Entity {id: $fromId}), (parent:Entity {id: $toId})
        MERGE (child)-[r:${rel}]->(parent)
        SET r.percentage = $percentage
        RETURN child
      `,
      {
        fromId: edge.fromId,
        toId: edge.toId,
        percentage: edge.percentage,
      },
    );
  } else {
    await runCypherWrite(
      client,
      `
        MATCH (child:Entity {id: $fromId}), (parent:Entity {id: $toId})
        MERGE (child)-[:${rel}]->(parent)
        RETURN child
      `,
      { fromId: edge.fromId, toId: edge.toId },
    );
  }
}

async function upsertProduct(
  client: PoolClient,
  product: NormalizedProduct,
): Promise<void> {
  await runCypherWrite(
    client,
    `
      MERGE (p:Product {gtin: $gtin})
      SET p.name = $name, p.category = $category
      RETURN p
    `,
    {
      gtin: product.gtin,
      name: product.name,
      category: product.category ?? '',
    },
  );

  if (product.manufacturerEntityId) {
    await runCypherWrite(
      client,
      `
        MATCH (p:Product {gtin: $gtin}), (e:Entity {id: $entityId})
        MERGE (p)-[:MANUFACTURED_BY]->(e)
        RETURN p
      `,
      {
        gtin: product.gtin,
        entityId: product.manufacturerEntityId,
      },
    );
  }
}

async function upsertCitation(
  client: PoolClient,
  entityId: string,
  citation: { id: string; url: string; title: string },
): Promise<void> {
  await runCypherWrite(
    client,
    `
      MATCH (e:Entity {id: $entityId})
      MERGE (c:Citation {id: $id})
      SET c.url = $url, c.title = $title
      MERGE (e)-[:HAS_CITATION]->(c)
      RETURN c
    `,
    {
      entityId,
      id: citation.id,
      url: citation.url,
      title: citation.title,
    },
  );
}

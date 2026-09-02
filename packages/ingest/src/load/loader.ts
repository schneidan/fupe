import type { PoolClient } from 'pg';
import type {
  LoadStats,
  NormalizedEdge,
  NormalizedEntity,
  NormalizedProduct,
  SourceBatch,
} from '../types';
import { runCypherWrite } from './client';

export async function loadBatch(
  client: PoolClient,
  batch: SourceBatch,
): Promise<LoadStats> {
  const stats: LoadStats = {
    entitiesUpserted: 0,
    edgesUpserted: 0,
    productsUpserted: 0,
    citationsUpserted: 0,
  };

  for (const entity of batch.entities) {
    await upsertEntity(client, entity);
    stats.entitiesUpserted++;
    if (entity.citation) {
      await upsertCitation(client, entity.id, entity.citation);
      stats.citationsUpserted++;
    }
  }

  for (const edge of batch.edges) {
    await upsertEdge(client, edge);
    stats.edgesUpserted++;
    if (edge.citation) {
      await upsertCitation(client, edge.fromId, edge.citation);
      stats.citationsUpserted++;
    }
  }

  for (const product of batch.products) {
    await upsertProduct(client, product);
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

  const rel = edge.type === 'PORTFOLIO_COMPANY_OF' ? 'PORTFOLIO_COMPANY_OF' : 'OWNED_BY';

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

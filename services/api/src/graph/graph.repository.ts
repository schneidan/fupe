import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { GraphService } from '../database/graph.service';
import { DATABASE_POOL } from '../database/database.constants';
import {
  ChainNode,
  CitationProperties,
  EntityProperties,
  EntityType,
  FuzzySearchHit,
  LookupResult,
  ProductProperties,
} from './graph.types';

const PE_TYPES = new Set([EntityType.PE_FIRM, EntityType.VC_FIRM]);
const MAX_TRAVERSAL_DEPTH = 10;

@Injectable()
export class GraphRepository {
  constructor(
    private readonly graph: GraphService,
    @Inject(DATABASE_POOL) private readonly pool: Pool,
  ) {}

  async fuzzySearch(query: string, limit = 10): Promise<FuzzySearchHit[]> {
    const { rows } = await this.pool.query<{
      kind: string;
      id: string;
      name: string;
      type: string | null;
      gtin: string | null;
      score: number;
    }>(
      `
        SELECT * FROM (
          SELECT
            'entity' AS kind,
            properties::jsonb->>'id' AS id,
            properties::jsonb->>'name' AS name,
            properties::jsonb->>'type' AS type,
            NULL::text AS gtin,
            similarity((properties::jsonb->>'name'), $1) AS score
          FROM fupe_graph."Entity"
          WHERE similarity((properties::jsonb->>'name'), $1) > 0.1

          UNION ALL

          SELECT
            'product' AS kind,
            properties::jsonb->>'gtin' AS id,
            properties::jsonb->>'name' AS name,
            NULL::text AS type,
            properties::jsonb->>'gtin' AS gtin,
            similarity((properties::jsonb->>'name'), $1) AS score
          FROM fupe_graph."Product"
          WHERE similarity((properties::jsonb->>'name'), $1) > 0.1
        ) hits
        ORDER BY score DESC
        LIMIT $2
      `,
      [query, limit],
    );

    return rows.map((r) => ({
      kind: r.kind as 'entity' | 'product',
      id: r.id,
      name: r.name,
      type: r.type ?? undefined,
      gtin: r.gtin ?? undefined,
      score: r.score,
    }));
  }

  async findProductByGtin(gtin: string): Promise<ProductProperties | null> {
    const rows = await this.graph.runCypher<{
      product: { properties: ProductProperties };
    }>(
      `MATCH (p:Product) WHERE p.gtin = $gtin RETURN p AS product LIMIT 1`,
      { gtin },
      ['product'],
    );
    return rows[0]?.product.properties ?? null;
  }

  async findEntityById(entityId: string): Promise<EntityProperties | null> {
    const rows = await this.graph.runCypher<{
      entity: { properties: EntityProperties };
    }>(
      `MATCH (e:Entity) WHERE e.id = $entityId RETURN e AS entity LIMIT 1`,
      { entityId },
      ['entity'],
    );
    return rows[0]?.entity.properties ?? null;
  }

  async createProduct(product: ProductProperties): Promise<ProductProperties> {
    await this.graph.runCypherWrite(
      `CREATE (p:Product {gtin: $gtin, name: $name, category: $category})`,
      {
        gtin: product.gtin,
        name: product.name,
        category: product.category,
      },
    );
    return product;
  }

  async linkProductToEntity(gtin: string, entityId: string): Promise<void> {
    await this.graph.runCypherWrite(
      `
        MATCH (p:Product), (e:Entity)
        WHERE p.gtin = $gtin AND e.id = $entityId
        MERGE (p)-[:MANUFACTURED_BY]->(e)
      `,
      { gtin, entityId },
    );
  }

  async getCitationsForEntity(entityId: string): Promise<CitationProperties[]> {
    const rows = await this.graph.runCypher<{
      citation: { properties: CitationProperties };
    }>(
      `
        MATCH (e:Entity)-[:HAS_CITATION]->(c:Citation)
        WHERE e.id = $entityId
        RETURN c AS citation
      `,
      { entityId },
      ['citation'],
    );
    return rows.map((r) => r.citation.properties);
  }

  async resolveFromEntity(entity: EntityProperties): Promise<LookupResult> {
    const chain = await this.buildOwnershipChain(entity.id);
    const citations = await this.getCitationsForEntity(entity.id);
    return this.toLookupResult(entity.name, chain, citations);
  }

  async resolveFromProduct(gtin: string): Promise<LookupResult | null> {
    const rows = await this.graph.runCypher<{
      product: { properties: ProductProperties };
      manufacturer: { properties: EntityProperties } | null;
    }>(
      `
        MATCH (p:Product)
        WHERE p.gtin = $gtin
        OPTIONAL MATCH (p)-[:MANUFACTURED_BY]->(m:Entity)
        RETURN p AS product, m AS manufacturer
        LIMIT 1
      `,
      { gtin },
      ['product', 'manufacturer'],
    );

    if (!rows.length) return null;

    const { product, manufacturer } = rows[0];
    const matchedName = product.properties.name;

    if (!manufacturer) {
      return {
        matched_item: matchedName,
        is_private_equity_owned: false,
        ultimate_parent: null,
        ownership_chain: [{ name: matchedName, type: 'PRODUCT' }],
        citations: [],
      };
    }

    const chain = await this.buildOwnershipChain(manufacturer.properties.id);
    const citations = await this.getCitationsForEntity(
      manufacturer.properties.id,
    );
    const fullChain: ChainNode[] = [
      { name: matchedName, type: 'PRODUCT' },
      ...chain,
    ];
    return this.toLookupResult(matchedName, fullChain, citations);
  }

  async buildOwnershipChain(entityId: string): Promise<ChainNode[]> {
    const rows = await this.graph.runCypher<{
      chain: Array<{ properties: EntityProperties }> | null;
    }>(
      `
        MATCH (start:Entity)
        WHERE start.id = $entityId
        OPTIONAL MATCH p = (start)-[:OWNED_BY*1..${MAX_TRAVERSAL_DEPTH}]->(ancestor:Entity)
        WITH p
        ORDER BY length(p) DESC
        LIMIT 1
        RETURN [n IN nodes(p) | n] AS chain
      `,
      { entityId },
      ['chain'],
    );

    const pathNodes = rows[0]?.chain;
    if (!pathNodes?.length) {
      const entity = await this.findEntityById(entityId);
      return entity ? [{ name: entity.name, type: entity.type }] : [];
    }

    return pathNodes.map((n) => ({
      name: n.properties.name,
      type: n.properties.type,
    }));
  }

  async applyEntityUpdate(
    entityId: string,
    data: Partial<EntityProperties>,
  ): Promise<EntityProperties | null> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { entityId };

    if (data.name) {
      sets.push('e.name = $name');
      params.name = data.name;
    }
    if (data.type) {
      sets.push('e.type = $type');
      params.type = data.type;
    }

    if (!sets.length) return this.findEntityById(entityId);

    const rows = await this.graph.runCypher<{
      entity: { properties: EntityProperties };
    }>(
      `MATCH (e:Entity) WHERE e.id = $entityId SET ${sets.join(', ')} RETURN e AS entity`,
      params,
      ['entity'],
    );

    return rows[0]?.entity.properties ?? null;
  }

  async createEntity(entity: EntityProperties): Promise<EntityProperties> {
    await this.graph.runCypherWrite(
      `CREATE (e:Entity {id: $id, name: $name, type: $type})`,
      { id: entity.id, name: entity.name, type: entity.type },
    );
    return entity;
  }

  async createOwnershipEdge(
    fromId: string,
    toId: string,
    percentage?: number,
  ): Promise<void> {
    if (percentage != null) {
      await this.graph.runCypherWrite(
        `
          MATCH (child:Entity), (parent:Entity)
          WHERE child.id = $fromId AND parent.id = $toId
          MERGE (child)-[r:OWNED_BY]->(parent)
          SET r.percentage = $percentage
        `,
        { fromId, toId, percentage },
      );
    } else {
      await this.graph.runCypherWrite(
        `
          MATCH (child:Entity), (parent:Entity)
          WHERE child.id = $fromId AND parent.id = $toId
          MERGE (child)-[:OWNED_BY]->(parent)
        `,
        { fromId, toId },
      );
    }
  }

  async addCitation(
    entityId: string,
    citation: CitationProperties,
  ): Promise<void> {
    await this.graph.runCypherWrite(
      `
        MATCH (e:Entity)
        WHERE e.id = $entityId
        MERGE (c:Citation {id: $id})
        SET c.url = $url, c.title = $title
        MERGE (e)-[:HAS_CITATION]->(c)
      `,
      {
        entityId,
        id: citation.id,
        url: citation.url,
        title: citation.title,
      },
    );
  }

  private toLookupResult(
    matchedItem: string,
    chain: ChainNode[],
    citations: CitationProperties[],
  ): LookupResult {
    const peOrVcInChain = chain.filter((n) => PE_TYPES.has(n.type as EntityType));
    const ultimateParent =
      chain.length > 1 ? chain[chain.length - 1] : chain[0] ?? null;

    return {
      matched_item: matchedItem,
      is_private_equity_owned: peOrVcInChain.length > 0,
      ultimate_parent: ultimateParent,
      ownership_chain: chain,
      citations: citations.map((c) => ({ title: c.title, url: c.url })),
    };
  }

  generateEntityId(): string {
    return randomUUID();
  }

  generateCitationId(): string {
    return randomUUID();
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { GraphService } from '../database/graph.service';
import { DATABASE_POOL } from '../database/database.constants';
import {
  ChainNode,
  CitationDto,
  CitationProperties,
  EntityDetail,
  EntityProperties,
  EntitySummary,
  EntityType,
  FuzzySearchHit,
  LookupResult,
  ProductProperties,
  RelatedEntities,
  RelatedEntitySummary,
} from './graph.types';

const PE_TYPES = new Set([EntityType.PE_FIRM, EntityType.VC_FIRM]);
const STALE_MONTHS_DEFAULT = 6;

function isCitationStale(c: CitationProperties): boolean {
  if (c.stale === true || c.stale === 'true') return true;
  if (!c.retrieved_at) return false;
  const retrieved = Date.parse(c.retrieved_at);
  if (Number.isNaN(retrieved)) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - STALE_MONTHS_DEFAULT);
  return retrieved < cutoff.getTime();
}

function toCitationDto(c: CitationProperties): CitationDto {
  return {
    title: c.title,
    url: c.url,
    retrieved_at: c.retrieved_at,
    stale: isCitationStale(c),
  };
}
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
    return this.toLookupResult(entity.name, chain, citations, entity.id);
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
    return this.toLookupResult(
      matchedName,
      fullChain,
      citations,
      manufacturer.properties.id,
    );
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
    const validNodes = (pathNodes ?? []).filter(
      (n): n is { properties: EntityProperties } =>
        n != null && typeof n === 'object' && n.properties != null,
    );

    if (!validNodes.length) {
      const entity = await this.findEntityById(entityId);
      return entity ? [{ name: entity.name, type: entity.type }] : [];
    }

    return validNodes.map((n) => ({
      name: n.properties.name,
      type: n.properties.type,
    }));
  }

  async listEntities(options: {
    q?: string;
    type?: string;
    country?: string;
    peOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ items: EntitySummary[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;

    const peIds = options.peOnly ? await this.getPeBackedEntityIds() : null;
    if (options.peOnly && peIds && !peIds.size) {
      return { items: [], total: 0, page, limit };
    }

    const conditions: string[] = ['TRUE'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.q?.trim()) {
      conditions.push(
        `(properties::jsonb->>'name' ILIKE $${paramIndex} OR properties::jsonb->>'aliases' ILIKE $${paramIndex})`,
      );
      params.push(`%${options.q.trim()}%`);
      paramIndex++;
    }

    if (options.type) {
      conditions.push(`properties::jsonb->>'type' = $${paramIndex}`);
      params.push(options.type);
      paramIndex++;
    }

    if (options.country) {
      conditions.push(
        `properties::jsonb->>'country_codes' LIKE $${paramIndex}`,
      );
      params.push(`%"${options.country.toUpperCase()}"%`);
      paramIndex++;
    }

    if (peIds) {
      conditions.push(
        `properties::jsonb->>'id' = ANY($${paramIndex}::text[])`,
      );
      params.push([...peIds]);
      paramIndex++;
    }

    const where = conditions.join(' AND ');

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM fupe_graph."Entity" WHERE ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const { rows } = await this.pool.query<{ properties: string }>(
      `
        SELECT properties::text AS properties
        FROM fupe_graph."Entity"
        WHERE ${where}
        ORDER BY properties::jsonb->>'name' ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset],
    );

    const peBackedSet = await this.getPeBackedEntityIds();
    const items = rows.map((row) => {
      const entity = this.parseEntityProperties(
        JSON.parse(row.properties.replace(/::vertex$/i, '')),
      );
      return this.toEntitySummary(entity, peBackedSet.has(entity.id));
    });

    return { items, total, page, limit };
  }

  async findEntityBySlug(slug: string): Promise<EntityProperties | null> {
    const { rows } = await this.pool.query<{ properties: string }>(
      `
        SELECT properties::text AS properties
        FROM fupe_graph."Entity"
        WHERE properties::jsonb->>'slug' = $1
           OR properties::jsonb->>'id' = $1
        LIMIT 1
      `,
      [slug],
    );

    if (!rows.length) return null;

    return this.parseEntityProperties(
      JSON.parse(rows[0].properties.replace(/::vertex$/i, '')),
    );
  }

  async getEntityDetail(slug: string): Promise<EntityDetail | null> {
    const entity = await this.findEntityBySlug(slug);
    if (!entity) return null;

    const chain = await this.buildOwnershipChain(entity.id);
    const citations = await this.getCitationsForEntity(entity.id);
    const peBackedSet = await this.getPeBackedEntityIds();

    return {
      ...this.toEntitySummary(entity, peBackedSet.has(entity.id)),
      ownership_chain: chain,
      citations: citations.map(toCitationDto),
      aliases: entity.aliases,
      source: entity.source,
      updated_at: entity.updated_at,
    };
  }

  async getRelatedEntities(entityId: string): Promise<RelatedEntities> {
    const [sameUltimateParent, similarPeBacked] = await Promise.all([
      this.getSameUltimateParentEntities(entityId),
      this.getSimilarPeBackedEntities(entityId),
    ]);

    return { same_ultimate_parent: sameUltimateParent, similar_pe_backed: similarPeBacked };
  }

  async getPeBackedEntityIds(): Promise<Set<string>> {
    const rows = await this.graph.runCypher<{ id: string }>(
      `
        MATCH (e:Entity)-[:OWNED_BY*1..${MAX_TRAVERSAL_DEPTH}]->(pe:Entity)
        WHERE pe.type IN ['PE_FIRM', 'VC_FIRM']
        RETURN DISTINCT e.id AS id
      `,
      {},
      ['id'],
    );

    return new Set(
      rows.map((r) => (typeof r.id === 'object' ? String(r.id) : r.id)).filter(Boolean),
    );
  }

  private async getSameUltimateParentEntities(
    entityId: string,
  ): Promise<RelatedEntitySummary[]> {
    const rows = await this.graph.runCypher<{
      other: { properties: EntityProperties };
    }>(
      `
        MATCH (start:Entity)
        WHERE start.id = $entityId
        OPTIONAL MATCH p = (start)-[:OWNED_BY*1..${MAX_TRAVERSAL_DEPTH}]->(ancestor:Entity)
        WITH start, p
        ORDER BY length(p) DESC
        LIMIT 1
        WITH start, last(nodes(p)) AS ultimateParent
        WHERE ultimateParent IS NOT NULL
        MATCH (other:Entity)-[:OWNED_BY*1..${MAX_TRAVERSAL_DEPTH}]->(parent:Entity)
        WHERE parent.id = ultimateParent.id
          AND other.id <> start.id
          AND other.type = 'BRAND'
        RETURN DISTINCT other AS other
        LIMIT 8
      `,
      { entityId },
      ['other'],
    );

    return rows
      .map((r) => r.other?.properties)
      .filter((p): p is EntityProperties => !!p)
      .map((p) => this.toRelatedSummary(p));
  }

  private async getSimilarPeBackedEntities(
    entityId: string,
  ): Promise<RelatedEntitySummary[]> {
    const entity = await this.findEntityById(entityId);
    if (!entity?.sector) return [];

    const rows = await this.graph.runCypher<{
      other: { properties: EntityProperties };
    }>(
      `
        MATCH (other:Entity)
        WHERE other.sector = $sector
          AND other.id <> $entityId
          AND other.type = 'BRAND'
        MATCH (other)-[:OWNED_BY*1..${MAX_TRAVERSAL_DEPTH}]->(pe:Entity)
        WHERE pe.type IN ['PE_FIRM', 'VC_FIRM']
        RETURN DISTINCT other AS other
        LIMIT 8
      `,
      { entityId, sector: entity.sector },
      ['other'],
    );

    return rows
      .map((r) => r.other?.properties)
      .filter((p): p is EntityProperties => !!p)
      .map((p) => this.toRelatedSummary(p));
  }

  private toEntitySummary(
    entity: EntityProperties,
    isPeBacked: boolean,
  ): EntitySummary {
    return {
      id: entity.id,
      slug: entity.slug ?? entity.id,
      name: entity.name,
      type: entity.type,
      sector: entity.sector,
      country_codes: entity.country_codes,
      is_pe_backed: isPeBacked,
    };
  }

  private toRelatedSummary(entity: EntityProperties): RelatedEntitySummary {
    return {
      id: entity.id,
      name: entity.name,
      slug: entity.slug ?? entity.id,
      type: entity.type,
    };
  }

  private parseEntityProperties(raw: Record<string, unknown>): EntityProperties {
    return {
      id: String(raw.id),
      name: String(raw.name),
      type: raw.type as EntityType,
      slug: raw.slug ? String(raw.slug) : undefined,
      sector: raw.sector ? String(raw.sector) : undefined,
      source: raw.source ? String(raw.source) : undefined,
      updated_at: raw.updated_at ? String(raw.updated_at) : undefined,
      country_codes: this.parseJsonArray(raw.country_codes),
      aliases: this.parseJsonArray(raw.aliases),
    };
  }

  private parseJsonArray(value: unknown): string[] | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
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
    const retrievedAt =
      citation.retrieved_at ?? new Date().toISOString().slice(0, 10);
    await this.graph.runCypherWrite(
      `
        MATCH (e:Entity)
        WHERE e.id = $entityId
        MERGE (c:Citation {id: $id})
        SET c.url = $url,
            c.title = $title,
            c.retrieved_at = $retrievedAt,
            c.stale = false
        MERGE (e)-[:HAS_CITATION]->(c)
      `,
      {
        entityId,
        id: citation.id,
        url: citation.url,
        title: citation.title,
        retrievedAt,
      },
    );
  }

  private async toLookupResult(
    matchedItem: string,
    chain: ChainNode[],
    citations: CitationProperties[],
    entityId?: string,
  ): Promise<LookupResult> {
    const peOrVcInChain = chain.filter((n) => PE_TYPES.has(n.type as EntityType));
    const ultimateParent =
      chain.length > 1 ? chain[chain.length - 1] : chain[0] ?? null;

    const result: LookupResult = {
      matched_item: matchedItem,
      entity_id: entityId,
      is_private_equity_owned: peOrVcInChain.length > 0,
      ultimate_parent: ultimateParent,
      ownership_chain: chain,
      citations: citations.map(toCitationDto),
    };

    if (entityId) {
      result.related = await this.getRelatedEntities(entityId);
    }

    return result;
  }

  generateEntityId(): string {
    return randomUUID();
  }

  generateCitationId(): string {
    return randomUUID();
  }
}

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
    const q = query.trim();
    if (!q) return [];

    const { rows } = await this.pool.query<{
      kind: string;
      id: string;
      name: string;
      type: string | null;
      gtin: string | null;
      slug: string | null;
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
            properties::jsonb->>'slug' AS slug,
            GREATEST(
              similarity(properties::jsonb->>'name', $1),
              CASE
                WHEN lower(properties::jsonb->>'name') = lower($1) THEN 1.0
                WHEN lower(btrim(properties::jsonb->>'name')) = lower(btrim($1)) THEN 1.0
                WHEN lower(properties::jsonb->>'slug') = lower(regexp_replace(lower($1), '[^a-z0-9]+', '-', 'g'))
                  THEN 0.98
                WHEN lower(properties::jsonb->>'name') LIKE lower($1) || '%' THEN 0.85
                -- Mid-string contains: skip for short queries (utz ≠ Schutzstaffel)
                WHEN char_length(btrim($1)) > 4
                  AND lower(properties::jsonb->>'name') LIKE '%' || lower($1) || '%' THEN 0.55
                ELSE 0
              END,
              COALESCE((
                SELECT MAX(similarity(alias.value, $1))
                FROM jsonb_array_elements_text(
                  CASE
                    WHEN jsonb_typeof(properties::jsonb->'aliases') = 'array'
                      THEN properties::jsonb->'aliases'
                    WHEN properties::jsonb->>'aliases' IS NOT NULL
                      AND left(btrim(properties::jsonb->>'aliases'), 1) = '['
                      THEN (properties::jsonb->>'aliases')::jsonb
                    ELSE '[]'::jsonb
                  END
                ) AS alias(value)
              ), 0)
            ) AS score
          FROM fupe_graph."Entity"

          UNION ALL

          SELECT
            'product' AS kind,
            properties::jsonb->>'gtin' AS id,
            properties::jsonb->>'name' AS name,
            NULL::text AS type,
            properties::jsonb->>'gtin' AS gtin,
            NULL::text AS slug,
            GREATEST(
              similarity(properties::jsonb->>'name', $1),
              CASE
                WHEN lower(properties::jsonb->>'name') = lower($1) THEN 1.0
                WHEN lower(properties::jsonb->>'name') LIKE lower($1) || '%' THEN 0.85
                ELSE 0
              END
            ) AS score
          FROM fupe_graph."Product"
        ) hits
        WHERE score >= $3
        ORDER BY score DESC, name ASC
        LIMIT $2
      `,
      [q, limit, 0.25],
    );

    return rows.map((r) => ({
      kind: r.kind as 'entity' | 'product',
      id: r.id,
      name: r.name,
      type: r.type ?? undefined,
      gtin: r.gtin ?? undefined,
      slug: r.slug ?? undefined,
      score: Number(r.score),
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
      const q = options.q.trim();
      // Short tokens: prefix / alias prefix only — avoid "utz" → Schutzstaffel
      if (q.length <= 3) {
        conditions.push(
          `(properties::jsonb->>'name' ILIKE $${paramIndex} OR properties::jsonb->>'aliases' ILIKE $${paramIndex})`,
        );
        params.push(`${q}%`);
      } else {
        conditions.push(
          `(properties::jsonb->>'name' ILIKE $${paramIndex} OR properties::jsonb->>'aliases' ILIKE $${paramIndex})`,
        );
        params.push(`%${q}%`);
      }
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
    const entity =
      (await this.findEntityBySlug(slug)) ??
      (await this.findEntityById(slug));
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
      external_ids: this.parseJsonObject(raw.external_ids),
    };
  }

  private parseJsonObject(
    value: unknown,
  ): Record<string, string> | undefined {
    if (!value) return undefined;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v != null) out[k] = String(v);
      }
      return Object.keys(out).length ? out : undefined;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return this.parseJsonObject(parsed);
      } catch {
        return undefined;
      }
    }
    return undefined;
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
    data: Partial<EntityProperties> & {
      clear_sector?: boolean;
      clear_aliases?: boolean;
      clear_country_codes?: boolean;
    },
  ): Promise<EntityProperties | null> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { entityId };

    if (data.name != null && data.name.trim()) {
      sets.push('e.name = $name');
      params.name = data.name.trim();
    }
    if (data.type) {
      sets.push('e.type = $type');
      params.type = data.type;
    }
    if (data.slug != null && data.slug.trim()) {
      sets.push('e.slug = $slug');
      params.slug = data.slug.trim();
    }
    if (data.sector != null) {
      sets.push('e.sector = $sector');
      params.sector = data.sector;
    } else if (data.clear_sector) {
      sets.push('e.sector = null');
    }
    if (data.country_codes) {
      sets.push('e.country_codes = $country_codes');
      params.country_codes = data.country_codes;
    } else if (data.clear_country_codes) {
      sets.push('e.country_codes = null');
    }
    if (data.aliases) {
      sets.push('e.aliases = $aliases');
      params.aliases = data.aliases;
    } else if (data.clear_aliases) {
      sets.push('e.aliases = null');
    }

    sets.push('e.updated_at = $updated_at');
    params.updated_at = new Date().toISOString().slice(0, 10);

    if (sets.length <= 1 && !data.name && !data.type && data.slug == null) {
      // only updated_at — still fine to stamp
    }

    const rows = await this.graph.runCypher<{
      entity: { properties: EntityProperties };
    }>(
      `MATCH (e:Entity) WHERE e.id = $entityId SET ${sets.join(', ')} RETURN e AS entity`,
      params,
      ['entity'],
    );

    return rows[0]?.entity.properties
      ? this.parseEntityProperties(
          rows[0].entity.properties as unknown as Record<string, unknown>,
        )
      : this.findEntityById(entityId);
  }

  /** Remove entity and all incident edges (ownership, citations, product links). */
  async deleteEntity(entityId: string): Promise<boolean> {
    const existing = await this.findEntityById(entityId);
    if (!existing) return false;
    await this.graph.runCypherWrite(
      `MATCH (e:Entity) WHERE e.id = $entityId DETACH DELETE e`,
      { entityId },
    );
    return true;
  }

  /**
   * Graph neighbors that would be orphaned / unlinked if this entity is deleted.
   * Children keep existing but lose their OWNED_BY edge to this node.
   */
  async getEntityDependencies(entityId: string): Promise<{
    children: Array<{ id: string; name: string; slug: string; type: string }>;
    parents: Array<{ id: string; name: string; slug: string; type: string }>;
    products: Array<{ gtin: string; name: string }>;
  }> {
    const [childRows, parentRows, productRows] = await Promise.all([
      this.graph.runCypher<{
        id: string;
        name: string;
        slug: string | null;
        type: string;
      }>(
        `
          MATCH (child:Entity)-[:OWNED_BY]->(e:Entity)
          WHERE e.id = $entityId
          RETURN child.id AS id, child.name AS name, child.slug AS slug, child.type AS type
        `,
        { entityId },
        ['id', 'name', 'slug', 'type'],
      ),
      this.graph.runCypher<{
        id: string;
        name: string;
        slug: string | null;
        type: string;
      }>(
        `
          MATCH (e:Entity)-[:OWNED_BY]->(parent:Entity)
          WHERE e.id = $entityId
          RETURN parent.id AS id, parent.name AS name, parent.slug AS slug, parent.type AS type
        `,
        { entityId },
        ['id', 'name', 'slug', 'type'],
      ),
      this.graph.runCypher<{ gtin: string; name: string }>(
        `
          MATCH (p:Product)-[:MANUFACTURED_BY]->(e:Entity)
          WHERE e.id = $entityId
          RETURN p.gtin AS gtin, p.name AS name
        `,
        { entityId },
        ['gtin', 'name'],
      ),
    ]);

    const mapEnt = (r: {
      id: string;
      name: string;
      slug: string | null;
      type: string;
    }) => ({
      id: String(r.id),
      name: String(r.name),
      slug: String(r.slug ?? r.id),
      type: String(r.type),
    });

    return {
      children: childRows.map(mapEnt),
      parents: parentRows.map(mapEnt),
      products: productRows.map((r) => ({
        gtin: String(r.gtin),
        name: String(r.name),
      })),
    };
  }

  async createEntity(entity: EntityProperties): Promise<EntityProperties> {
    const params: Record<string, unknown> = {
      id: entity.id,
      name: entity.name,
      type: entity.type,
    };
    const sets = ['e.id = $id', 'e.name = $name', 'e.type = $type'];

    if (entity.slug) {
      sets.push('e.slug = $slug');
      params.slug = entity.slug;
    }
    if (entity.sector) {
      sets.push('e.sector = $sector');
      params.sector = entity.sector;
    }
    if (entity.country_codes?.length) {
      sets.push('e.country_codes = $country_codes');
      params.country_codes = entity.country_codes;
    }
    if (entity.source) {
      sets.push('e.source = $source');
      params.source = entity.source;
    }
    if (entity.updated_at) {
      sets.push('e.updated_at = $updated_at');
      params.updated_at = entity.updated_at;
    }

    await this.graph.runCypherWrite(
      `CREATE (e:Entity)
       SET ${sets.join(', ')}`,
      params,
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

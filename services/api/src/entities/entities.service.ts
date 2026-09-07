import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AuthService, AuthUser } from '../auth/auth.service';
import { writeAdminAudit } from '../admin/audit-log';
import { normalizeNameKey, toSlug } from '../common/slug';
import { DATABASE_POOL } from '../database/database.constants';
import { GraphRepository } from '../graph/graph.repository';
import { EntityProperties } from '../graph/graph.types';
import { UpdateEntityDto } from './entities.dto';

@Injectable()
export class EntitiesService {
  constructor(
    private readonly graphRepo: GraphRepository,
    private readonly authService: AuthService,
    @Inject(DATABASE_POOL) private readonly pool: Pool,
  ) {}

  list(query: {
    q?: string;
    type?: string;
    country?: string;
    pe_only?: boolean;
    page?: number;
    limit?: number;
  }) {
    return this.graphRepo.listEntities({
      q: query.q,
      type: query.type,
      country: query.country,
      peOnly: query.pe_only,
      page: query.page,
      limit: query.limit,
    });
  }

  async getBySlug(slug: string) {
    const entity = await this.graphRepo.getEntityDetail(slug);
    if (!entity) {
      throw new NotFoundException(`Entity "${slug}" not found`);
    }
    return entity;
  }

  async getRelated(slugOrId: string) {
    const entity =
      (await this.graphRepo.findEntityBySlug(slugOrId)) ??
      (await this.graphRepo.findEntityById(slugOrId));

    if (!entity) {
      throw new NotFoundException(`Entity "${slugOrId}" not found`);
    }

    return this.graphRepo.getRelatedEntities(entity.id);
  }

  async getDependenciesAsModerator(actor: AuthUser, idOrSlug: string) {
    if (!this.authService.isModerator(actor)) {
      throw new ForbiddenException('Moderator role required');
    }
    const entity = await this.resolveEntity(idOrSlug);
    if (!entity) {
      throw new NotFoundException(`Entity "${idOrSlug}" not found`);
    }
    const deps = await this.graphRepo.getEntityDependencies(entity.id);
    return {
      entity_id: entity.id,
      name: entity.name,
      ...deps,
      has_dependents:
        deps.children.length > 0 ||
        deps.parents.length > 0 ||
        deps.products.length > 0,
    };
  }

  async updateAsModerator(
    actor: AuthUser,
    idOrSlug: string,
    dto: UpdateEntityDto,
  ) {
    if (!this.authService.isModerator(actor)) {
      throw new ForbiddenException('Moderator role required');
    }

    const previous = await this.resolveEntity(idOrSlug);
    if (!previous) {
      throw new NotFoundException(`Entity "${idOrSlug}" not found`);
    }

    const patch: Parameters<GraphRepository['applyEntityUpdate']>[1] = {};

    if (dto.name != null && dto.name.trim()) {
      patch.name = dto.name.trim();
      patch.slug = toSlug(dto.name);
    }
    if (dto.type) patch.type = dto.type;

    if (dto.sector !== undefined) {
      const sector = dto.sector.trim();
      if (sector) patch.sector = sector;
      else patch.clear_sector = true;
    }

    if (dto.country_codes !== undefined) {
      const codes = dto.country_codes
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      if (codes.length) patch.country_codes = codes;
      else patch.clear_country_codes = true;
    }

    if (dto.aliases !== undefined) {
      const aliases = dto.aliases.map((a) => a.trim()).filter(Boolean);
      if (aliases.length) patch.aliases = aliases;
      else patch.clear_aliases = true;
    }

    const updated = await this.graphRepo.applyEntityUpdate(previous.id, patch);
    if (!updated) {
      throw new NotFoundException(`Entity "${idOrSlug}" not found`);
    }

    await writeAdminAudit(this.pool, {
      actorId: actor.id,
      action: 'entity_update',
      targetType: 'entity',
      targetId: previous.id,
      previousState: this.auditSnapshot(previous),
      newState: this.auditSnapshot(updated),
    });

    return this.graphRepo.getEntityDetail(updated.slug ?? updated.id);
  }

  async deleteAsModerator(actor: AuthUser, idOrSlug: string) {
    if (!this.authService.isModerator(actor)) {
      throw new ForbiddenException('Moderator role required');
    }

    const previous = await this.resolveEntity(idOrSlug);
    if (!previous) {
      throw new NotFoundException(`Entity "${idOrSlug}" not found`);
    }

    const dependencies = await this.graphRepo.getEntityDependencies(
      previous.id,
    );

    await this.addToBlocklist(previous, actor.id);
    await this.cleanupRelationalRefs(previous.id);

    const ok = await this.graphRepo.deleteEntity(previous.id);
    if (!ok) {
      throw new NotFoundException(`Entity "${idOrSlug}" not found`);
    }

    await writeAdminAudit(this.pool, {
      actorId: actor.id,
      action: 'entity_delete',
      targetType: 'entity',
      targetId: previous.id,
      previousState: {
        ...this.auditSnapshot(previous),
        dependencies,
      },
      newState: { blocked: true },
      note: 'Deleted and added to entity_blocklist',
    });

    return {
      deleted: true,
      blocked: true,
      id: previous.id,
      name: previous.name,
      dependencies,
    };
  }

  private async addToBlocklist(
    entity: EntityProperties,
    blockedBy: string,
  ): Promise<void> {
    const nameKey = normalizeNameKey(entity.name);
    const aliasKeys = (entity.aliases ?? []).map(normalizeNameKey).filter(Boolean);
    await this.pool.query(
      `INSERT INTO public.entity_blocklist
         (entity_id, slug, name, name_key, external_ids, aliases, source, reason, blocked_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
       ON CONFLICT (entity_id) DO UPDATE SET
         slug = EXCLUDED.slug,
         name = EXCLUDED.name,
         name_key = EXCLUDED.name_key,
         external_ids = EXCLUDED.external_ids,
         aliases = EXCLUDED.aliases,
         source = EXCLUDED.source,
         reason = EXCLUDED.reason,
         blocked_by = EXCLUDED.blocked_by,
         created_at = now()`,
      [
        entity.id,
        entity.slug ?? null,
        entity.name,
        nameKey,
        JSON.stringify(entity.external_ids ?? {}),
        JSON.stringify(aliasKeys),
        entity.source ?? null,
        'Deleted by moderator',
        blockedBy,
      ],
    );
  }

  /** Drop pending queue rows that pointed at the deleted entity. */
  private async cleanupRelationalRefs(entityId: string): Promise<void> {
    await this.pool.query(
      `UPDATE public.edits_queue
       SET status = 'REJECTED',
           review_note = COALESCE(review_note, '') ||
             CASE WHEN review_note IS NULL OR review_note = '' THEN '' ELSE ' ' END ||
             '[auto] Target entity deleted'
       WHERE target_node_id = $1 AND status = 'PENDING'`,
      [entityId],
    );
    await this.pool.query(
      `UPDATE public.ingest_match_queue
       SET status = 'rejected',
           resolved_at = now()
       WHERE candidate_entity_id = $1 AND status = 'pending'`,
      [entityId],
    );
  }

  private async resolveEntity(
    idOrSlug: string,
  ): Promise<EntityProperties | null> {
    return (
      (await this.graphRepo.findEntityById(idOrSlug)) ??
      (await this.graphRepo.findEntityBySlug(idOrSlug))
    );
  }

  private auditSnapshot(entity: EntityProperties) {
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      slug: entity.slug,
      sector: entity.sector,
      country_codes: entity.country_codes,
      aliases: entity.aliases,
      external_ids: entity.external_ids,
    };
  }
}

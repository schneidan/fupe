import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { toSlug } from '../common/slug';
import { DATABASE_POOL } from '../database/database.constants';
import { GraphRepository } from '../graph/graph.repository';
import { EntityType } from '../graph/graph.types';
import { AuthService, AuthUser } from '../auth/auth.service';
import { UsersRepository } from '../auth/users.repository';

export type EditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Placeholder target when proposing a brand-new entity (Phase 5.3). */
export const NEW_ENTITY_TARGET = '__new_entity__';

export interface CreateEntityProposal {
  name: string;
  type: EntityType;
  sector?: string;
  country_codes?: string[];
}

export interface ProposedEditData {
  entity?: { name?: string; type?: EntityType };
  ownership?: { parent_id?: string; percentage?: number };
  new_parent?: { name: string; type: EntityType };
  create_entity?: CreateEntityProposal;
}

export interface SubmitEditDto {
  target_node_id?: string;
  proposed_data: ProposedEditData;
  citation_url?: string;
}

const TRUST_AUTO_COMMIT_THRESHOLD = 50;
const MAX_PENDING_EDITS = 5;
const TRUST_ON_APPROVE = 5;
const TRUST_ON_REJECT = -10;

@Injectable()
export class EditsService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly graphRepo: GraphRepository,
    private readonly usersRepo: UsersRepository,
    private readonly authService: AuthService,
  ) {}

  async submitEdit(user: AuthUser, dto: SubmitEditDto) {
    this.validateSubmitDto(dto);

    if (!user.email_verified) {
      throw new ForbiddenException(
        'Verify your email before submitting edits',
      );
    }

    const pendingCount = await this.countPending(user.id);
    if (pendingCount >= MAX_PENDING_EDITS) {
      throw new HttpException(
        `You already have ${MAX_PENDING_EDITS} pending edits. Wait for review before submitting more.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const targetNodeId = this.resolveTargetNodeId(dto);
    const normalized: SubmitEditDto = { ...dto, target_node_id: targetNodeId };

    // New entities always require moderator approval (Phase 5.3).
    if (!this.isNewEntitySubmission(normalized)) {
      if (user.trust_score > TRUST_AUTO_COMMIT_THRESHOLD) {
        return this.commitEdit(user.id, normalized);
      }
    }

    const { rows } = await this.pool.query(
      `INSERT INTO public.edits_queue (user_id, target_node_id, proposed_data, citation_url, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [
        user.id,
        targetNodeId,
        JSON.stringify(dto.proposed_data),
        dto.citation_url ?? null,
      ],
    );

    return { status: 'queued', edit: rows[0] };
  }

  async listPending() {
    const { rows } = await this.pool.query(
      `SELECT eq.*, u.email AS submitter_email, u.trust_score AS submitter_trust
       FROM public.edits_queue eq
       JOIN public.users u ON u.id = eq.user_id
       WHERE eq.status = 'PENDING'
       ORDER BY eq.created_at ASC`,
    );
    return { edits: rows };
  }

  async listMine(userId: string, status?: EditStatus) {
    const params: unknown[] = [userId];
    let statusClause = '';
    if (status) {
      params.push(status);
      statusClause = `AND status = $2`;
    }

    const { rows } = await this.pool.query(
      `SELECT id, target_node_id, proposed_data, citation_url, status,
              reviewer_id, reviewed_at, created_at
       FROM public.edits_queue
       WHERE user_id = $1 ${statusClause}
       ORDER BY created_at DESC`,
      params,
    );
    return { edits: rows };
  }

  async reviewEdit(
    reviewer: AuthUser,
    editId: string,
    decision: 'APPROVED' | 'REJECTED',
  ) {
    if (!this.authService.isModerator(reviewer)) {
      throw new ForbiddenException('Moderator role required to review edits');
    }

    const { rows } = await this.pool.query(
      `SELECT * FROM public.edits_queue WHERE id = $1 AND status = 'PENDING'`,
      [editId],
    );
    const edit = rows[0];
    if (!edit) throw new NotFoundException('Edit not found');

    if (decision === 'APPROVED') {
      await this.commitEdit(edit.user_id, {
        target_node_id: edit.target_node_id,
        proposed_data: edit.proposed_data,
        citation_url: edit.citation_url,
      });
      await this.usersRepo.adjustTrustScore(edit.user_id, TRUST_ON_APPROVE);
    } else {
      await this.usersRepo.adjustTrustScore(edit.user_id, TRUST_ON_REJECT);
    }

    const { rows: updated } = await this.pool.query(
      `UPDATE public.edits_queue
       SET status = $1, reviewer_id = $2, reviewed_at = now()
       WHERE id = $3
       RETURNING *`,
      [decision, reviewer.id, editId],
    );

    return updated[0];
  }

  isNewEntitySubmission(dto: SubmitEditDto): boolean {
    return Boolean(dto.proposed_data.create_entity);
  }

  private resolveTargetNodeId(dto: SubmitEditDto): string {
    if (this.isNewEntitySubmission(dto)) {
      return NEW_ENTITY_TARGET;
    }
    const id = dto.target_node_id?.trim();
    if (!id) {
      throw new BadRequestException('target_node_id is required');
    }
    return id;
  }

  private async countPending(userId: string): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
       FROM public.edits_queue
       WHERE user_id = $1 AND status = 'PENDING'`,
      [userId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  private async commitEdit(userId: string, dto: SubmitEditDto) {
    const proposed = dto.proposed_data;
    let targetNodeId = dto.target_node_id ?? NEW_ENTITY_TARGET;
    let previousState: Record<string, unknown> | null = null;

    if (proposed.create_entity) {
      targetNodeId = await this.createEntityFromProposal(proposed.create_entity);
      previousState = null;
    } else {
      const entity = await this.graphRepo.findEntityById(targetNodeId);
      previousState = entity ? { ...entity } : null;
      if (!entity) {
        throw new NotFoundException(`Entity ${targetNodeId} not found`);
      }
    }

    if (proposed.entity) {
      await this.graphRepo.applyEntityUpdate(targetNodeId, proposed.entity);
    }

    if (proposed.ownership?.parent_id) {
      await this.graphRepo.createOwnershipEdge(
        targetNodeId,
        proposed.ownership.parent_id,
        proposed.ownership.percentage,
      );
    }

    if (proposed.new_parent) {
      const parentId = this.graphRepo.generateEntityId();
      await this.graphRepo.createEntity({
        id: parentId,
        name: proposed.new_parent.name,
        type: proposed.new_parent.type,
        slug: toSlug(proposed.new_parent.name) || parentId,
        source: 'community',
        updated_at: new Date().toISOString(),
      });
      await this.graphRepo.createOwnershipEdge(
        targetNodeId,
        parentId,
        proposed.ownership?.percentage,
      );
    }

    if (dto.citation_url) {
      await this.graphRepo.addCitation(targetNodeId, {
        id: this.graphRepo.generateCitationId(),
        url: dto.citation_url,
        title: 'Community citation',
      });
    }

    const updatedEntity = await this.graphRepo.findEntityById(targetNodeId);

    await this.pool.query(
      `INSERT INTO public.audit_logs (entity_id, previous_state, new_state, edited_by)
       VALUES ($1, $2, $3, $4)`,
      [
        targetNodeId,
        previousState ? JSON.stringify(previousState) : null,
        JSON.stringify({ ...updatedEntity, proposed_data: proposed }),
        userId,
      ],
    );

    await this.pool.query(
      `INSERT INTO public.wiki_revisions (entity_id, revision_data, citation_url, edited_by)
       VALUES ($1, $2, $3, $4)`,
      [
        targetNodeId,
        JSON.stringify(proposed),
        dto.citation_url ?? null,
        userId,
      ],
    );

    return { status: 'committed', entity: updatedEntity };
  }

  private async createEntityFromProposal(
    proposal: CreateEntityProposal,
  ): Promise<string> {
    const name = proposal.name.trim();
    const slug = toSlug(name);
    const id = slug || this.graphRepo.generateEntityId();

    const byId = await this.graphRepo.findEntityById(id);
    if (byId) {
      throw new BadRequestException(
        `An entity with id "${id}" already exists`,
      );
    }
    if (slug) {
      const bySlug = await this.graphRepo.findEntityBySlug(slug);
      if (bySlug) {
        throw new BadRequestException(
          `An entity with slug "${slug}" already exists`,
        );
      }
    }

    await this.graphRepo.createEntity({
      id,
      name,
      type: proposal.type,
      slug: slug || id,
      sector: proposal.sector?.trim() || undefined,
      country_codes: proposal.country_codes?.length
        ? proposal.country_codes
        : undefined,
      source: 'community',
      updated_at: new Date().toISOString(),
    });

    return id;
  }

  private validateSubmitDto(dto: SubmitEditDto) {
    const proposed = dto.proposed_data;

    if (proposed.create_entity) {
      const ce = proposed.create_entity;
      if (!ce.name?.trim()) {
        throw new BadRequestException('create_entity.name is required');
      }
      if (!ce.type || !Object.values(EntityType).includes(ce.type)) {
        throw new BadRequestException('create_entity.type is required');
      }
      if (!dto.citation_url) {
        throw new BadRequestException(
          'citation_url is required when proposing a new entity',
        );
      }
    } else if (!dto.target_node_id?.trim()) {
      throw new BadRequestException('target_node_id is required');
    }

    this.validateCitationRequirement(dto);
  }

  private validateCitationRequirement(dto: SubmitEditDto) {
    const proposed = dto.proposed_data;
    const involvesPe =
      proposed.create_entity?.type === EntityType.PE_FIRM ||
      proposed.entity?.type === EntityType.PE_FIRM ||
      proposed.new_parent?.type === EntityType.PE_FIRM ||
      proposed.ownership != null;

    if (involvesPe && !dto.citation_url) {
      throw new BadRequestException(
        'citation_url is required when changing PE/VC ownership',
      );
    }

    if (dto.citation_url) {
      try {
        new URL(dto.citation_url);
      } catch {
        throw new BadRequestException('citation_url must be a valid URL');
      }
    }
  }
}

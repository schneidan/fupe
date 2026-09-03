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
/** Rejected edits can be reopened to PENDING within this window. */
const REOPEN_WINDOW_MS = 1000 * 60 * 60 * 48;

export type EditKind = 'ownership' | 'create_entity' | 'other';

export interface QueueListFilters {
  status?: EditStatus | 'ALL';
  kind?: EditKind;
  submitter?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

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
    return this.listQueue({ status: 'PENDING', page: 1, limit: 200 });
  }

  async listQueue(filters: QueueListFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const status = filters.status ?? 'PENDING';
    if (status !== 'ALL') {
      conditions.push(`eq.status = $${i++}`);
      values.push(status);
    }

    if (filters.kind === 'create_entity') {
      conditions.push(`eq.proposed_data ? 'create_entity'`);
    } else if (filters.kind === 'ownership') {
      conditions.push(
        `(eq.proposed_data ? 'ownership' OR eq.proposed_data ? 'new_parent')`,
      );
      conditions.push(`NOT (eq.proposed_data ? 'create_entity')`);
    } else if (filters.kind === 'other') {
      conditions.push(`NOT (eq.proposed_data ? 'create_entity')`);
      conditions.push(
        `NOT (eq.proposed_data ? 'ownership') AND NOT (eq.proposed_data ? 'new_parent')`,
      );
    }

    if (filters.submitter?.trim()) {
      conditions.push(`u.email ILIKE $${i++}`);
      values.push(`%${filters.submitter.trim()}%`);
    }

    if (filters.from) {
      conditions.push(`eq.created_at >= $${i++}::timestamptz`);
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`eq.created_at < ($${i++}::date + interval '1 day')`);
      values.push(filters.to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
       FROM public.edits_queue eq
       JOIN public.users u ON u.id = eq.user_id
       ${where}`,
      values,
    );

    const { rows } = await this.pool.query(
      `SELECT eq.*,
              u.email AS submitter_email,
              u.trust_score AS submitter_trust,
              r.email AS reviewer_email,
              CASE
                WHEN eq.proposed_data ? 'create_entity' THEN 'create_entity'
                WHEN eq.proposed_data ? 'ownership' OR eq.proposed_data ? 'new_parent' THEN 'ownership'
                ELSE 'other'
              END AS edit_kind,
              CASE
                WHEN eq.status = 'REJECTED'
                 AND eq.reviewed_at IS NOT NULL
                 AND eq.reviewed_at > now() - interval '48 hours'
                THEN true
                ELSE false
              END AS can_reopen
       FROM public.edits_queue eq
       JOIN public.users u ON u.id = eq.user_id
       LEFT JOIN public.users r ON r.id = eq.reviewer_id
       ${where}
       ORDER BY
         CASE WHEN eq.status = 'PENDING' THEN 0 ELSE 1 END,
         COALESCE(eq.reviewed_at, eq.created_at) DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset],
    );

    return {
      edits: rows,
      total: Number(countRes.rows[0]?.n ?? 0),
      page,
      limit,
    };
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
    reviewNote?: string,
  ) {
    if (!this.authService.isModerator(reviewer)) {
      throw new ForbiddenException('Moderator role required to review edits');
    }

    const note = reviewNote?.trim() || null;
    if (note && note.length > 2000) {
      throw new BadRequestException('review_note must be ≤ 2000 characters');
    }

    const { rows } = await this.pool.query(
      `SELECT * FROM public.edits_queue WHERE id = $1 AND status = 'PENDING'`,
      [editId],
    );
    const edit = rows[0];
    if (!edit) throw new NotFoundException('Edit not found or already reviewed');

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
       SET status = $1,
           reviewer_id = $2,
           reviewed_at = now(),
           review_note = $3
       WHERE id = $4
       RETURNING *`,
      [decision, reviewer.id, note, editId],
    );

    return updated[0];
  }

  /**
   * Re-open a REJECTED edit back to PENDING within the undo window.
   * Reverses the rejection trust penalty. Approved commits are not undone.
   */
  async reopenEdit(reviewer: AuthUser, editId: string) {
    if (!this.authService.isModerator(reviewer)) {
      throw new ForbiddenException('Moderator role required to reopen edits');
    }

    const { rows } = await this.pool.query(
      `SELECT * FROM public.edits_queue WHERE id = $1`,
      [editId],
    );
    const edit = rows[0];
    if (!edit) throw new NotFoundException('Edit not found');
    if (edit.status !== 'REJECTED') {
      throw new BadRequestException(
        'Only rejected edits can be reopened (approved commits stay in the graph)',
      );
    }
    if (!edit.reviewed_at) {
      throw new BadRequestException('Edit has no review timestamp');
    }
    const reviewedAt = new Date(edit.reviewed_at).getTime();
    if (Date.now() - reviewedAt > REOPEN_WINDOW_MS) {
      throw new BadRequestException(
        'Reopen window expired (48 hours after rejection)',
      );
    }

    await this.usersRepo.adjustTrustScore(edit.user_id, -TRUST_ON_REJECT);

    const { rows: updated } = await this.pool.query(
      `UPDATE public.edits_queue
       SET status = 'PENDING',
           reviewer_id = NULL,
           reviewed_at = NULL,
           review_note = COALESCE(review_note, '') || CASE
             WHEN review_note IS NULL OR review_note = '' THEN '[reopened]'
             ELSE E'\n[reopened]'
           END
       WHERE id = $1
       RETURNING *`,
      [editId],
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

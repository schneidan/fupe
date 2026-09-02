import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants';
import { GraphRepository } from '../graph/graph.repository';
import { EntityType } from '../graph/graph.types';
import { AuthUser } from '../auth/auth.service';

export type EditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProposedEditData {
  entity?: { name?: string; type?: EntityType };
  /** parent_id required when linking an existing parent; optional when only supplying percentage for new_parent */
  ownership?: { parent_id?: string; percentage?: number };
  new_parent?: { name: string; type: EntityType };
}

export interface SubmitEditDto {
  target_node_id: string;
  proposed_data: ProposedEditData;
  citation_url?: string;
}

const TRUST_AUTO_COMMIT_THRESHOLD = 50;

@Injectable()
export class EditsService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly graphRepo: GraphRepository,
  ) {}

  async submitEdit(user: AuthUser, dto: SubmitEditDto) {
    this.validateCitationRequirement(dto);

    if (user.trust_score > TRUST_AUTO_COMMIT_THRESHOLD) {
      return this.commitEdit(user.id, dto);
    }

    const { rows } = await this.pool.query(
      `INSERT INTO public.edits_queue (user_id, target_node_id, proposed_data, citation_url, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [
        user.id,
        dto.target_node_id,
        JSON.stringify(dto.proposed_data),
        dto.citation_url ?? null,
      ],
    );

    return { status: 'queued', edit: rows[0] };
  }

  async listPending() {
    const { rows } = await this.pool.query(
      `SELECT eq.*, u.email AS submitter_email
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
    if (reviewer.trust_score <= TRUST_AUTO_COMMIT_THRESHOLD) {
      throw new ForbiddenException('Insufficient trust score to review edits');
    }

    const { rows } = await this.pool.query(
      `SELECT * FROM public.edits_queue WHERE id = $1 AND status = 'PENDING'`,
      [editId],
    );
    const edit = rows[0];
    if (!edit) throw new NotFoundException('Edit not found');

    if (decision === 'APPROVED') {
      await this.commitEdit(reviewer.id, {
        target_node_id: edit.target_node_id,
        proposed_data: edit.proposed_data,
        citation_url: edit.citation_url,
      });
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

  private async commitEdit(userId: string, dto: SubmitEditDto) {
    const entity = await this.graphRepo.findEntityById(dto.target_node_id);
    const previousState = entity ? { ...entity } : null;

    const proposed = dto.proposed_data;

    if (proposed.entity) {
      await this.graphRepo.applyEntityUpdate(dto.target_node_id, proposed.entity);
    }

    if (proposed.ownership?.parent_id) {
      await this.graphRepo.createOwnershipEdge(
        dto.target_node_id,
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
      });
      await this.graphRepo.createOwnershipEdge(
        dto.target_node_id,
        parentId,
        proposed.ownership?.percentage,
      );
    }

    if (dto.citation_url) {
      await this.graphRepo.addCitation(dto.target_node_id, {
        id: this.graphRepo.generateCitationId(),
        url: dto.citation_url,
        title: 'Community citation',
      });
    }

    const updatedEntity = await this.graphRepo.findEntityById(dto.target_node_id);

    await this.pool.query(
      `INSERT INTO public.audit_logs (entity_id, previous_state, new_state, edited_by)
       VALUES ($1, $2, $3, $4)`,
      [
        dto.target_node_id,
        previousState ? JSON.stringify(previousState) : null,
        JSON.stringify({ ...updatedEntity, proposed_data: proposed }),
        userId,
      ],
    );

    await this.pool.query(
      `INSERT INTO public.wiki_revisions (entity_id, revision_data, citation_url, edited_by)
       VALUES ($1, $2, $3, $4)`,
      [
        dto.target_node_id,
        JSON.stringify(proposed),
        dto.citation_url ?? null,
        userId,
      ],
    );

    return { status: 'committed', entity: updatedEntity };
  }

  private validateCitationRequirement(dto: SubmitEditDto) {
    const proposed = dto.proposed_data;
    const involvesPe =
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

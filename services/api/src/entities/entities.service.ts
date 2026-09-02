import { Injectable, NotFoundException } from '@nestjs/common';
import { GraphRepository } from '../graph/graph.repository';

@Injectable()
export class EntitiesService {
  constructor(private readonly graphRepo: GraphRepository) {}

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
}

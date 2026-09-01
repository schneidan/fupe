import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { GraphRepository } from './graph.repository';
import { LookupResult } from './graph.types';
import {
  OwnershipResult,
  ProductOwnershipResult,
  SearchResult,
} from './graphql.models';

@Resolver()
export class GraphResolver {
  constructor(private readonly graphRepo: GraphRepository) {}

  @Query(() => SearchResult, { description: 'Fuzzy text search across entities and products' })
  async searchEntities(
    @Args('query') query: string,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
  ): Promise<SearchResult> {
    const hits = await this.graphRepo.fuzzySearch(query, limit);
    const entities = hits
      .filter((h) => h.kind === 'entity')
      .map((h) => ({ id: h.id, name: h.name, type: h.type as never }));
    return { entities, count: entities.length };
  }

  @Query(() => OwnershipResult, {
    nullable: true,
    description: 'Get ownership chain for an entity',
  })
  async ownershipChain(
    @Args('entityId') entityId: string,
  ): Promise<OwnershipResult | null> {
    const entity = await this.graphRepo.findEntityById(entityId);
    if (!entity) return null;

    const result = await this.graphRepo.resolveFromEntity(entity);
    return this.toOwnershipResult(result);
  }

  @Query(() => ProductOwnershipResult, {
    nullable: true,
    description: 'Lookup product by GTIN and resolve ownership',
  })
  async productByGtin(
    @Args('gtin') gtin: string,
  ): Promise<ProductOwnershipResult | null> {
    const result = await this.graphRepo.resolveFromProduct(gtin);
    if (!result) return null;

    return {
      product: {
        gtin,
        name: result.matched_item,
        category: 'unknown',
      },
      manufacturer: (result.ownership_chain[1] ?? null) as never,
      owners: result.ownership_chain.slice(1) as never,
      isPeBacked: result.is_private_equity_owned,
      peFirms: result.ownership_chain.filter(
        (n) => n.type === 'PE_FIRM' || n.type === 'VC_FIRM',
      ) as never,
    };
  }

  private toOwnershipResult(result: LookupResult): OwnershipResult {
    return {
      entity: result.ownership_chain[0] as never,
      owners: result.ownership_chain.slice(1) as never,
      isPeBacked: result.is_private_equity_owned,
      peFirms: result.ownership_chain.filter(
        (n) => n.type === 'PE_FIRM' || n.type === 'VC_FIRM',
      ) as never,
    };
  }
}

import { Module } from '@nestjs/common';
import { GraphRepository } from './graph.repository';
import { GraphResolver } from './graph.resolver';
import { isGraphqlEnabled } from '../common/security';

@Module({
  providers: [
    GraphRepository,
    ...(isGraphqlEnabled() ? [GraphResolver] : []),
  ],
  exports: [GraphRepository],
})
export class GraphModule {}

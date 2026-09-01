import { Module } from '@nestjs/common';
import { GraphRepository } from './graph.repository';
import { GraphResolver } from './graph.resolver';

@Module({
  providers: [GraphRepository, GraphResolver],
  exports: [GraphRepository],
})
export class GraphModule {}

import { Module } from '@nestjs/common';
import { GraphModule } from '../graph/graph.module';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';

@Module({
  imports: [GraphModule],
  controllers: [EntitiesController],
  providers: [EntitiesService],
})
export class EntitiesModule {}

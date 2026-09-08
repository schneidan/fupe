import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GraphModule } from '../graph/graph.module';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';

@Module({
  imports: [GraphModule, AuthModule],
  controllers: [EntitiesController],
  providers: [EntitiesService],
  exports: [EntitiesService],
})
export class EntitiesModule {}

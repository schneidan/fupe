import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GraphModule } from '../graph/graph.module';
import { EntitiesController } from './entities.controller';
import { EntitiesIpQuotaService } from './entities-ip-quota.service';
import { EntitiesIpThrottleGuard } from './entities-ip-throttle.guard';
import { EntitiesService } from './entities.service';

@Module({
  imports: [GraphModule, AuthModule],
  controllers: [EntitiesController],
  providers: [EntitiesService, EntitiesIpQuotaService, EntitiesIpThrottleGuard],
  exports: [EntitiesService],
})
export class EntitiesModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GraphModule } from '../graph/graph.module';
import { EditsController } from './edits.controller';
import { EditsService } from './edits.service';

@Module({
  imports: [AuthModule, GraphModule],
  controllers: [EditsController],
  providers: [EditsService],
})
export class EditsModule {}

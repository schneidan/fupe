import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GraphModule } from '../graph/graph.module';
import { MailModule } from '../mail/mail.module';
import { EditsController } from './edits.controller';
import { EditsService } from './edits.service';

@Module({
  imports: [AuthModule, GraphModule, MailModule],
  controllers: [EditsController],
  providers: [EditsService],
})
export class EditsModule {}

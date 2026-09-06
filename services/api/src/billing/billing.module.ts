import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { MailModule } from '../mail/mail.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AuthModule, ApiKeysModule, MailModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}

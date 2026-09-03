import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiUsageInterceptor } from './api-usage.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [ApiKeysController],
  providers: [
    ApiKeysService,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiUsageInterceptor,
    },
  ],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}

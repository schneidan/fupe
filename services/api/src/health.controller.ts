import { Controller, Get } from '@nestjs/common';
import { SkipApiKey } from './api-keys/api-key.decorators';

@Controller('health')
@SkipApiKey()
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'fupe-api' };
  }
}

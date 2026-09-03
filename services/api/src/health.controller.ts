import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipApiKey } from './api-keys/api-key.decorators';

@ApiTags('Health')
@Controller('health')
@SkipApiKey()
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', service: 'fupe-api' },
    },
  })
  check() {
    return { status: 'ok', service: 'fupe-api' };
  }
}

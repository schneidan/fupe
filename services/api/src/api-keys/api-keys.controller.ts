import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersRepository } from '../auth/users.repository';
import { SkipApiKey } from './api-key.decorators';
import { ApiKeysService } from './api-keys.service';

class CreateApiKeyBody {
  @ApiPropertyOptional({ example: 'Production', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}

@ApiTags('API keys')
@ApiBearerAuth('bearer')
@Controller('api-keys')
@SkipApiKey()
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly users: UsersRepository,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create an API key',
    description: 'Returns the raw secret once. Pass it as `X-API-Key` on lookup requests.',
  })
  async create(
    @Req() req: { user: AuthUser },
    @Body() body: CreateApiKeyBody,
  ) {
    const user = await this.users.findById(req.user.id);
    const tier = user?.subscription_tier ?? 'free';
    const { key, rawKey } = await this.apiKeys.createKey(
      req.user.id,
      body.name ?? 'Default',
      tier,
    );
    return {
      key,
      /** Shown once — store it; we only keep a hash. */
      secret: rawKey,
      message:
        'Copy your API key now. It will not be shown again. Pass it as X-API-Key.',
    };
  }

  @Get()
  @ApiOperation({ summary: 'List your API keys' })
  @ApiOkResponse({ description: '{ keys: [...] }' })
  list(@Req() req: { user: AuthUser }) {
    return this.apiKeys.listForUser(req.user.id).then((keys) => ({ keys }));
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke an API key' })
  revoke(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.apiKeys.revoke(req.user.id, id);
  }
}

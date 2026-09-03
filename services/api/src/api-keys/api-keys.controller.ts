import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipApiKey } from './api-key.decorators';
import { ApiKeysService } from './api-keys.service';

class CreateApiKeyBody {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}

@Controller('api-keys')
@SkipApiKey()
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  async create(
    @Req() req: { user: AuthUser },
    @Body() body: CreateApiKeyBody,
  ) {
    const { key, rawKey } = await this.apiKeys.createKey(
      req.user.id,
      body.name ?? 'Default',
      'free',
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
  list(@Req() req: { user: AuthUser }) {
    return this.apiKeys.listForUser(req.user.id).then((keys) => ({ keys }));
  }

  @Post(':id/revoke')
  revoke(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.apiKeys.revoke(req.user.id, id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { SkipApiKey } from '../api-keys/api-key.decorators';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  DeleteEntityBodyDto,
  DeleteEntityQueryDto,
  ListEntitiesDto,
  UpdateEntityDto,
} from './entities.dto';
import { EntitiesService } from './entities.service';

@ApiTags('Entities')
@ApiSecurity('api-key')
@ApiHeader({
  name: 'X-API-Key',
  required: false,
  description: 'Optional API key (`fupe_…`) for rate-limited third-party access.',
})
@Controller('entities')
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Get()
  @ApiOperation({ summary: 'List / search directory entities' })
  list(@Query() query: ListEntitiesDto) {
    return this.entitiesService.list(query);
  }

  @Get(':slug/related')
  @ApiOperation({ summary: 'Related entities (“Did you know?”)' })
  related(@Param('slug') slug: string) {
    return this.entitiesService.getRelated(slug);
  }

  @Get(':idOrSlug/dependencies')
  @SkipApiKey()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Entity graph dependencies (moderator/admin)',
    description:
      'Children, parents, and products that would be unlinked if this entity is deleted.',
  })
  dependencies(
    @Req() req: { user: AuthUser },
    @Param('idOrSlug') idOrSlug: string,
  ) {
    return this.entitiesService.getDependenciesAsModerator(req.user, idOrSlug);
  }

  @Get(':idOrSlug/ownership-chain')
  @SkipApiKey()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Preview ownership-chain delete (admin)',
    description:
      'Lists every entity in the OWNED_BY connected component that would be deleted.',
  })
  ownershipChain(
    @Req() req: { user: AuthUser },
    @Param('idOrSlug') idOrSlug: string,
  ) {
    return this.entitiesService.previewOwnershipChain(req.user, idOrSlug);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Entity detail by slug' })
  @ApiOkResponse({ description: 'Entity with ownership chain and citations' })
  detail(@Param('slug') slug: string) {
    return this.entitiesService.getBySlug(slug);
  }

  @Patch(':idOrSlug')
  @SkipApiKey()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update entity (moderator/admin)',
    description:
      'Direct name/type/sector/countries/aliases edit. Renaming updates the slug.',
  })
  update(
    @Req() req: { user: AuthUser },
    @Param('idOrSlug') idOrSlug: string,
    @Body() body: UpdateEntityDto,
  ) {
    return this.entitiesService.updateAsModerator(req.user, idOrSlug, body);
  }

  @Delete(':idOrSlug')
  @SkipApiKey()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete entity or ownership chain (moderator/admin)',
    description:
      'mode=entity (default): DETACH DELETE one node + blocklist. mode=chain (admin): delete full OWNED_BY component; requires body.confirm="yes".',
  })
  remove(
    @Req() req: { user: AuthUser },
    @Param('idOrSlug') idOrSlug: string,
    @Query() query: DeleteEntityQueryDto,
    @Body() body: DeleteEntityBodyDto = {},
  ) {
    return this.entitiesService.deleteAsModerator(req.user, idOrSlug, {
      mode: query.mode ?? 'entity',
      confirm: body?.confirm,
    });
  }
}

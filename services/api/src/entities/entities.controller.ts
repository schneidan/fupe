import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ListEntitiesDto } from './entities.dto';
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

  @Get(':slug')
  @ApiOperation({ summary: 'Entity detail by slug' })
  @ApiOkResponse({ description: 'Entity with ownership chain and citations' })
  detail(@Param('slug') slug: string) {
    return this.entitiesService.getBySlug(slug);
  }
}

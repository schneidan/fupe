import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListEntitiesDto } from './entities.dto';
import { EntitiesService } from './entities.service';

@Controller('entities')
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Get()
  list(@Query() query: ListEntitiesDto) {
    return this.entitiesService.list(query);
  }

  @Get(':slug/related')
  related(@Param('slug') slug: string) {
    return this.entitiesService.getRelated(slug);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.entitiesService.getBySlug(slug);
  }
}

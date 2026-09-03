import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService, AuthUser } from '../auth/auth.service';
import { SkipApiKey } from '../api-keys/api-key.decorators';
import {
  EditKind,
  EditStatus,
  EditsService,
  ProposedEditData,
} from './edits.service';

class SubmitEditBody {
  @IsOptional()
  @IsString()
  target_node_id?: string;

  @IsObject()
  proposed_data!: ProposedEditData;

  @IsOptional()
  @IsUrl()
  citation_url?: string;
}

class ReviewEditBody {
  @IsEnum(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  review_note?: string;
}

class ListMineQuery {
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED'])
  status?: EditStatus;
}

class ListQueueQuery {
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED', 'ALL'])
  status?: EditStatus | 'ALL';

  @IsOptional()
  @IsEnum(['ownership', 'create_entity', 'other'])
  kind?: EditKind;

  @IsOptional()
  @IsString()
  submitter?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

@Controller('edits')
@SkipApiKey()
@UseGuards(JwtAuthGuard)
export class EditsController {
  constructor(
    private readonly editsService: EditsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  submit(@Req() req: { user: AuthUser }, @Body() body: SubmitEditBody) {
    return this.editsService.submitEdit(req.user, body);
  }

  @Get('mine')
  listMine(
    @Req() req: { user: AuthUser },
    @Query() { status }: ListMineQuery,
  ) {
    return this.editsService.listMine(req.user.id, status);
  }

  @Get('queue')
  listQueue(@Req() req: { user: AuthUser }, @Query() query: ListQueueQuery) {
    if (!this.authService.isModerator(req.user)) {
      throw new ForbiddenException('Moderator role required');
    }
    return this.editsService.listQueue({
      status: query.status ?? 'PENDING',
      kind: query.kind,
      submitter: query.submitter,
      from: query.from,
      to: query.to,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Patch(':id/review')
  review(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() body: ReviewEditBody,
  ) {
    return this.editsService.reviewEdit(
      req.user,
      id,
      body.decision,
      body.review_note,
    );
  }

  @Post(':id/reopen')
  reopen(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.editsService.reopenEdit(req.user, id);
  }
}

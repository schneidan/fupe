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
import { IsEnum, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService, AuthUser } from '../auth/auth.service';
import { EditStatus, EditsService, ProposedEditData } from './edits.service';

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
}

class ListMineQuery {
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED'])
  status?: EditStatus;
}

@Controller('edits')
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
  listQueue(@Req() req: { user: AuthUser }) {
    if (!this.authService.isModerator(req.user)) {
      throw new ForbiddenException('Moderator role required');
    }
    return this.editsService.listPending();
  }

  @Patch(':id/review')
  review(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() { decision }: ReviewEditBody,
  ) {
    return this.editsService.reviewEdit(req.user, id, decision);
  }
}

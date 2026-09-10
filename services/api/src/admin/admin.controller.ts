import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiBearerAuth,
  ApiProduces,
} from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AdminGuard, AdminJwtUser } from './admin.guard';
import { AdminService } from './admin.service';
import { SkipApiKey } from '../api-keys/api-key.decorators';
import { UserRole } from '../auth/users.repository';

class ListUsersQuery {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(['user', 'moderator', 'admin']) role?: UserRole;
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === ''
      ? undefined
      : value === true || value === 'true',
  )
  @IsBoolean()
  disabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
}

class PatchUserBody {
  @IsOptional() @IsEnum(['user', 'moderator', 'admin']) role?: UserRole;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) trust_score?: number;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  email_verified?: boolean;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  disabled?: boolean;
}

class ListPageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
}

class OverrideTierBody {
  @IsEnum(['free', 'developer', 'pro']) tier!: 'free' | 'developer' | 'pro';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class AuditQuery {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 50;
}

class ResolveIngestBody {
  @IsEnum(['accepted', 'rejected', 'merged'])
  decision!: 'accepted' | 'rejected' | 'merged';
}

class IngestListQuery {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
}

class EmailUpdatesListQuery {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
}

class SendProductUpdateBody {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dry_run?: boolean;
}

class AdminEntitiesListQuery {
  @IsOptional() @IsString() prefix?: string;
  @IsOptional() @IsString() letter?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 50;
}

class BulkDeleteEntitiesBody {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

@ApiTags('Admin')
@ApiBearerAuth('bearer')
@ApiSecurity('bearer')
@Controller('admin')
@SkipApiKey()
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard counts' })
  stats() {
    return this.adminService.getStats();
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List / search users' })
  listUsers(@Query() query: ListUsersQuery) {
    return this.adminService.listUsers({
      q: query.q,
      role: query.role,
      disabled: query.disabled,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'User detail' })
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id')
  @ApiOperation({
    summary: 'Update role, trust, verification, or disabled state',
  })
  patchUser(
    @Param('id') id: string,
    @Body() body: PatchUserBody,
    @Req() req: { adminUser: AdminJwtUser },
  ) {
    return this.adminService.updateUser(req.adminUser.id, id, body);
  }

  @Get('users/:id/keys')
  @ApiOperation({ summary: "List a user's API keys + today's usage" })
  getUserKeys(@Param('id') id: string) {
    return this.adminService.getUserKeys(id).then((keys) => ({ keys }));
  }

  @Post('keys/:id/revoke')
  @ApiOperation({ summary: 'Revoke an API key (admin override)' })
  revokeKey(
    @Param('id') id: string,
    @Req() req: { adminUser: AdminJwtUser },
  ) {
    return this.adminService
      .revokeKeyAdmin(req.adminUser.id, id)
      .then(() => ({ revoked: true }));
  }

  // ── Product email updates ─────────────────────────────────────────────────

  @Get('email-updates/subscribers')
  @ApiOperation({ summary: 'List users opted in to product updates' })
  listEmailUpdateSubscribers(@Query() query: EmailUpdatesListQuery) {
    return this.adminService.listEmailUpdateSubscribers({
      q: query.q,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Get('email-updates/subscribers.csv')
  @ApiOperation({ summary: 'CSV export of product-update subscribers' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="fupe-email-updates-subscribers.csv"',
  )
  async exportEmailUpdateSubscribersCsv() {
    const csv = await this.adminService.exportEmailUpdateSubscribersCsv();
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="fupe-email-updates-subscribers.csv"',
    });
  }

  @Post('email-updates/send')
  @ApiOperation({
    summary: 'Send (or dry-run) a product update to opted-in users',
  })
  sendProductUpdate(
    @Body() body: SendProductUpdateBody,
    @Req() req: { adminUser: AdminJwtUser },
  ) {
    return this.adminService.sendProductUpdate(req.adminUser.id, {
      subject: body.subject,
      body: body.body,
      dry_run: body.dry_run,
    });
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  @Get('subscriptions')
  @ApiOperation({ summary: 'List paying / previously paying subscribers' })
  listSubscribers(@Query() query: ListPageQuery) {
    return this.adminService.listSubscribers({
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Get('billing/health')
  @ApiOperation({ summary: 'Stripe config + webhook sync health' })
  billingHealth() {
    return this.adminService.getBillingHealth();
  }

  @Get('audit')
  @ApiOperation({ summary: 'Admin audit log' })
  listAudit(@Query() query: AuditQuery) {
    return this.adminService.listAudit({
      action: query.action,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Post('users/:id/tier')
  @ApiOperation({ summary: 'Manually override subscription tier (audited)' })
  overrideTier(
    @Param('id') id: string,
    @Body() { tier, note }: OverrideTierBody,
    @Req() req: { adminUser: AdminJwtUser },
  ) {
    return this.adminService.overrideTier(req.adminUser.id, id, tier, note);
  }

  // ── Usage ──────────────────────────────────────────────────────────────────

  @Get('usage')
  @ApiOperation({ summary: "API key usage summary (today's requests)" })
  usageSummary(@Query() query: ListPageQuery) {
    return this.adminService.getUsageSummary({
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  // ── Ingest match queue ────────────────────────────────────────────────────

  @Get('ingest-matches')
  @ApiOperation({ summary: 'List ingest dedupe review queue' })
  listIngestMatches(@Query() query: IngestListQuery) {
    return this.adminService.listIngestMatches({
      status: query.status ?? 'pending',
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Post('ingest-matches/:id/resolve')
  @ApiOperation({ summary: 'Resolve an ingest match (accept / reject / merged)' })
  resolveIngestMatch(
    @Param('id') id: string,
    @Body() { decision }: ResolveIngestBody,
    @Req() req: { adminUser: AdminJwtUser },
  ) {
    return this.adminService.resolveIngestMatch(req.adminUser.id, id, decision);
  }

  // ── Entities ──────────────────────────────────────────────────────────────

  @Get('entities')
  @ApiOperation({
    summary: 'List entities for admin bulk delete (prefix + letter + counts)',
  })
  listEntities(@Query() query: AdminEntitiesListQuery) {
    return this.adminService.listEntities({
      prefix: query.prefix,
      letter: query.letter,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Post('entities/bulk-delete')
  @ApiOperation({
    summary: 'Bulk delete individual entities (no ownership chain)',
  })
  bulkDeleteEntities(
    @Body() body: BulkDeleteEntitiesBody,
    @Req() req: { adminUser: AdminJwtUser },
  ) {
    return this.adminService.bulkDeleteEntities(req.adminUser, body.ids ?? []);
  }
}

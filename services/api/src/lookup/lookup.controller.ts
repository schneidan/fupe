import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Get,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { RequestWithApiKey } from '../api-keys/api-key.guard';
import { TIER_ALLOWS_IMAGE } from '../api-keys/api-keys.service';
import {
  LookupResultDto,
  SearchDto,
  UnifiedLookupDto,
} from './lookup.dto';
import { LookupIpThrottleGuard } from './lookup-ip-throttle.guard';
import { LookupService } from './lookup.service';

@ApiTags('Lookup')
@ApiSecurity('api-key')
@ApiHeader({
  name: 'X-API-Key',
  required: false,
  description:
    'API key (`fupe_…`). Optional for first-party TEXT/BARCODE/VOICE unless REQUIRE_API_KEY=true. IMAGE needs a paid-tier key or X-Fupe-First-Party.',
})
@UseGuards(LookupIpThrottleGuard)
@Controller('lookup')
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Post()
  @ApiOperation({
    summary: 'Unified ownership lookup',
    description:
      'Resolve whether a brand/product/company is PE-backed. JSON body for TEXT/BARCODE; multipart for IMAGE/VOICE with a `file` field. IMAGE requires Developer/Business API key or first-party credential.',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({ type: UnifiedLookupDto })
  @ApiOkResponse({ type: LookupResultDto })
  @UseInterceptors(FileInterceptor('file'))
  async lookup(
    @Req() req: RequestWithApiKey,
    @Body() body: UnifiedLookupDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (body.type === 'IMAGE') {
      const firstPartyOk = this.isFirstPartyImage(req);
      if (req.apiKey) {
        if (!TIER_ALLOWS_IMAGE[req.apiKey.tier]) {
          throw new ForbiddenException(
            'IMAGE lookup requires Developer or Business tier. Upgrade at /developers.',
          );
        }
      } else if (!firstPartyOk) {
        throw new UnauthorizedException(
          'IMAGE lookup requires a Developer/Business API key, or a first-party client credential.',
        );
      }
    }

    const input = this.toLookupInput(body, file);
    return this.lookupService.resolve(input);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Fuzzy search (legacy)',
    description: 'Returns raw entity/product hits without PE resolution.',
  })
  async search(@Query() { q }: SearchDto) {
    const hits = await this.lookupService.fuzzySearchHits(q);
    return { query: q, results: hits, count: hits.length };
  }

  /** First-party web/mobile may call IMAGE without a paid API key. */
  private isFirstPartyImage(req: RequestWithApiKey): boolean {
    const expected = process.env.FIRST_PARTY_LOOKUP_SECRET?.trim();
    if (!expected) {
      // Local/dev convenience when secret is unset.
      return process.env.NODE_ENV !== 'production';
    }
    const header = req.header('x-fupe-first-party')?.trim();
    return Boolean(header && header === expected);
  }

  private toLookupInput(
    body: UnifiedLookupDto,
    file?: Express.Multer.File,
  ) {
    switch (body.type) {
      case 'BARCODE':
        return { type: body.type, gtin: body.gtin! };
      case 'TEXT':
        return { type: body.type, query: body.query! };
      case 'IMAGE':
        return { type: body.type, image: file?.buffer };
      case 'VOICE':
        return {
          type: body.type,
          transcript: body.transcript,
          audio: file?.buffer,
          audioMimeType: file?.mimetype,
        };
      default:
        return body;
    }
  }
}

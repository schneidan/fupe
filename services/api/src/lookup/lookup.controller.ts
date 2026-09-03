import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UploadedFile,
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
import { LookupService } from './lookup.service';

@ApiTags('Lookup')
@ApiSecurity('api-key')
@ApiHeader({
  name: 'X-API-Key',
  required: false,
  description:
    'API key (`fupe_…`). Optional for first-party clients unless REQUIRE_API_KEY=true. Required for third-party use; free tier cannot call IMAGE.',
})
@Controller('lookup')
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Post()
  @ApiOperation({
    summary: 'Unified ownership lookup',
    description:
      'Resolve whether a brand/product/company is PE-backed. JSON body for TEXT/BARCODE; multipart for IMAGE/VOICE with a `file` field.',
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
    if (body.type === 'IMAGE' && req.apiKey) {
      if (!TIER_ALLOWS_IMAGE[req.apiKey.tier]) {
        throw new ForbiddenException(
          'IMAGE lookup requires Developer or Business tier. Upgrade at /developers.',
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

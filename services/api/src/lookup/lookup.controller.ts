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
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { RequestWithApiKey } from '../api-keys/api-key.guard';
import { TIER_ALLOWS_IMAGE } from '../api-keys/api-keys.service';
import { LookupInputType, LookupService } from './lookup.service';

class UnifiedLookupDto {
  @IsEnum(['BARCODE', 'TEXT', 'IMAGE', 'VOICE'])
  type!: LookupInputType;

  @ValidateIf((o) => o.type === 'BARCODE')
  @IsString()
  @IsNotEmpty()
  gtin?: string;

  @ValidateIf((o) => o.type === 'TEXT')
  @IsString()
  @IsNotEmpty()
  query?: string;

  @ValidateIf((o) => o.type === 'VOICE')
  @IsOptional()
  @IsString()
  transcript?: string;
}

class SearchDto {
  @IsString()
  @IsNotEmpty()
  q!: string;
}

@Controller('lookup')
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  /**
   * Unified multi-modal lookup endpoint.
   * Accepts JSON body or multipart form (for IMAGE/VOICE with file uploads).
   */
  @Post()
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

  /** Legacy fuzzy text search (returns raw hits) */
  @Get('search')
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

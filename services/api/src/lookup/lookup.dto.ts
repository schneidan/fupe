import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { LookupInputType } from './lookup.service';

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  return undefined;
}

export class UnifiedLookupDto {
  @ApiProperty({
    enum: ['BARCODE', 'TEXT', 'IMAGE', 'VOICE'],
    example: 'TEXT',
    description:
      'Lookup mode. IMAGE requires a multipart `file` and Developer+ tier when using an API key.',
  })
  @IsEnum(['BARCODE', 'TEXT', 'IMAGE', 'VOICE'])
  type!: LookupInputType;

  @ApiPropertyOptional({
    example: '072830005016',
    description: 'Required when type is BARCODE (GTIN / UPC).',
  })
  @ValidateIf((o: UnifiedLookupDto) => o.type === 'BARCODE')
  @IsString()
  @IsNotEmpty()
  gtin?: string;

  @ApiPropertyOptional({
    example: 'Panera Bread',
    description: 'Required when type is TEXT.',
  })
  @ValidateIf((o: UnifiedLookupDto) => o.type === 'TEXT')
  @IsString()
  @IsNotEmpty()
  query?: string;

  @ApiPropertyOptional({
    description:
      'Optional transcript when type is VOICE (otherwise send audio as multipart `file`).',
  })
  @ValidateIf((o: UnifiedLookupDto) => o.type === 'VOICE')
  @IsOptional()
  @IsString()
  transcript?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'IMAGE only (JSON or multipart). When false, skip third-party vision and use on-server OCR only. Default true when omitted.',
  })
  @ValidateIf((o: UnifiedLookupDto) => o.type === 'IMAGE')
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  use_ai?: boolean;
}

export class SearchDto {
  @ApiProperty({ example: 'panera', description: 'Fuzzy search query' })
  @IsString()
  @IsNotEmpty()
  q!: string;
}

export class ChainNodeDto {
  @ApiProperty({ example: 'Panera Bread' })
  name!: string;

  @ApiProperty({ example: 'BRAND' })
  type!: string;

  @ApiPropertyOptional({ example: 'panera-bread' })
  slug?: string;
}

export class CitationDto {
  @ApiProperty({ example: 'SEC filing — JAB Holding' })
  title!: string;

  @ApiProperty({ example: 'https://example.com/source' })
  url!: string;

  @ApiPropertyOptional({ example: '2026-01-15T00:00:00.000Z' })
  retrieved_at?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'True when the citation is older than the stale threshold.',
  })
  stale?: boolean;
}

export class RelatedEntityDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Einstein Bros. Bagels' })
  name!: string;

  @ApiProperty({ example: 'einstein-bros-bagels' })
  slug!: string;

  @ApiProperty({ example: 'BRAND' })
  type!: string;
}

export class RelatedEntitiesDto {
  @ApiProperty({ type: [RelatedEntityDto] })
  same_ultimate_parent!: RelatedEntityDto[];

  @ApiProperty({ type: [RelatedEntityDto] })
  similar_pe_backed!: RelatedEntityDto[];
}

export class LookupResultDto {
  @ApiProperty({ example: 'Panera Bread' })
  matched_item!: string;

  @ApiPropertyOptional({ example: 'e_panera' })
  entity_id?: string;

  @ApiProperty({ example: true })
  is_private_equity_owned!: boolean;

  @ApiPropertyOptional({ type: ChainNodeDto, nullable: true })
  ultimate_parent!: ChainNodeDto | null;

  @ApiProperty({ type: [ChainNodeDto] })
  ownership_chain!: ChainNodeDto[];

  @ApiProperty({ type: [CitationDto] })
  citations!: CitationDto[];

  @ApiPropertyOptional({ type: RelatedEntitiesDto })
  related?: RelatedEntitiesDto;

  @ApiPropertyOptional({
    example: '2026-03-01T12:00:00.000Z',
    description: 'Entity last-updated timestamp when available.',
  })
  updated_at?: string;

  @ApiPropertyOptional({
    example: 'a Panera storefront',
    description: 'IMAGE only — short description of what the photo appears to show.',
  })
  interpretation?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object' },
    description:
      'IMAGE only — all ownership matches (one per distinct brand). Top-level fields mirror the first hit for older clients.',
  })
  results?: LookupResultDto[];
}

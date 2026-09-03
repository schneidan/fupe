import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { LookupInputType } from './lookup.service';

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
}

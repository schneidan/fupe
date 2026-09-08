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
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EntityType } from '../graph/graph.types';

export class ListEntitiesDto {
  @ApiPropertyOptional({ example: 'panera' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: EntityType })
  @IsOptional()
  @IsEnum(EntityType)
  type?: EntityType;

  @ApiPropertyOptional({ example: 'US', description: 'ISO country code filter' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  pe_only?: boolean;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class UpdateEntityDto {
  @ApiPropertyOptional({ example: 'Panera Bread' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: EntityType })
  @IsOptional()
  @IsEnum(EntityType)
  type?: EntityType;

  @ApiPropertyOptional({ example: 'Restaurants' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @ApiPropertyOptional({
    example: ['US', 'CA'],
    description: 'ISO country codes. Pass [] to clear.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  country_codes?: string[];

  @ApiPropertyOptional({
    example: ['Panera'],
    description: 'Alternate names. Pass [] to clear.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];
}

export class DeleteEntityQueryDto {
  @ApiPropertyOptional({
    enum: ['entity', 'chain'],
    default: 'entity',
    description:
      '`entity` deletes one node. `chain` deletes the full OWNED_BY connected component (admin only; requires body.confirm = yes).',
  })
  @IsOptional()
  @IsEnum(['entity', 'chain'])
  mode?: 'entity' | 'chain' = 'entity';
}

export class DeleteEntityBodyDto {
  @ApiPropertyOptional({
    example: 'yes',
    description: 'Required for mode=chain; must be exactly "yes".',
  })
  @IsOptional()
  @IsString()
  confirm?: string;
}

export class AdminListEntitiesDto {
  @ApiPropertyOptional({
    example: 'Pan',
    description: 'Name prefix typeahead (ILIKE prefix%)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  prefix?: string;

  @ApiPropertyOptional({
    example: 'P',
    description: 'A–Z letter filter, or # for non-letter names',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1)
  letter?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class BulkDeleteEntitiesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids!: string[];
}

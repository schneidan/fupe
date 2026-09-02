import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EntityType } from '../graph/graph.types';

export class ListEntitiesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(EntityType)
  type?: EntityType;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  pe_only?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

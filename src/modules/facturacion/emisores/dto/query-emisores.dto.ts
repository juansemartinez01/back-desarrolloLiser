import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsIn, IsOptional, Min, IsString } from 'class-validator';

export class QueryEmisoresDto {
  @IsOptional()
  @IsInt()
  @Min(20000000000)
  cuit_computador?: number;

  @IsOptional()
  @IsInt()
  @Min(20000000000)
  cuit_representado?: number;

  @IsOptional()
  @IsString()
  activo?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

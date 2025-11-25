import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsIn, IsOptional, Min } from 'class-validator';

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
  @IsBoolean()
  activo?: boolean;

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

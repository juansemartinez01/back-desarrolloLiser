import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryEstadoCuentaVaciosDto {
  @IsString()
  cliente_id: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  envase_id?: number;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  include_movimientos?: string; // 'true'|'false'
}

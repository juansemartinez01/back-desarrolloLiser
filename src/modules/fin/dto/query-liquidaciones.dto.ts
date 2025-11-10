import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { LiquidacionEstado } from '../enums/liquidacion-estado.enum';

export class QueryLiquidacionesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  proveedor_id?: number;

  @IsOptional()
  @IsEnum(LiquidacionEstado)
  estado?: LiquidacionEstado;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsString()
  order?: 'ASC' | 'DESC';
}

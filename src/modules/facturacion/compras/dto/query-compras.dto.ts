import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryComprasDto {
  @IsOptional() @IsInt() comprobante_tipo?: number;
  @IsOptional() @IsInt() punto_venta?: number;
  @IsOptional() @IsInt() nro_comprobante?: number;

  @IsOptional() @IsInt() doc_tipo_vendedor?: number;
  @IsOptional() @IsInt() doc_nro_vendedor?: number;

  @IsOptional() @IsString() nombre_vendedor?: string; // ILIKE
  @IsOptional() @IsString() desde?: string; // ISO date
  @IsOptional() @IsString() hasta?: string; // ISO date

  @IsOptional() @IsIn(['ASC', 'DESC']) order?: 'ASC' | 'DESC';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}

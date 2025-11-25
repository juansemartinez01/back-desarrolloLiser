import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryLibroIvaDto {
  @IsString() desde: string; // ISO date, ej: "2025-11-01"
  @IsString() hasta: string; // ISO date, ej: "2025-12-01" (exclusive)

  @IsOptional()
  @IsIn(['json', 'txt'])
  formato?: 'json' | 'txt' = 'json';

  // filtros opcionales
  @IsOptional() @IsInt() factura_tipo?: number; // AFIP cod
  @IsOptional() @IsInt() punto_venta?: number;

  // ventas: permite filtrar por cond IVA receptor, doc_tipo
  @IsOptional() @IsInt() cond_iva_receptor?: number;
  @IsOptional() @IsInt() doc_tipo?: number;

  // compras: proveedor (opcionales)
  @IsOptional() @IsInt() doc_tipo_vendedor?: number;
  @IsOptional() @IsInt() doc_nro_vendedor?: number;

  // paginación solo para JSON (para TXT devolvemos todo el rango)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;

  @IsOptional() @IsBoolean() include_test?: boolean;
}

export class QueryDashboardIvaDto {
  @IsString() desde: string; // ISO
  @IsString() hasta: string; // ISO
}

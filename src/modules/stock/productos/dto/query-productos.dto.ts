// src/modules/stock/productos/dto/query-productos.dto.ts
import { Type } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, IsString } from 'class-validator';

export class QueryProductosDto {
  @IsOptional()
  @IsString()
  search?: string; // filtra por nombre/código

  @IsOptional()
  @IsBooleanString()
  soloActivos?: string; // 'true' | 'false'

  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  limit?: number;

  // ✅ NUEVO
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  proveedor_id?: number;

  // ✅ opcional: traer solo productos sin proveedor
  @IsOptional()
  @IsBooleanString()
  sin_proveedor?: string; // 'true' | 'false'
}

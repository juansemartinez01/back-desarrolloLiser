// src/modules/stock/productos/dto/query-productos.dto.ts
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
}

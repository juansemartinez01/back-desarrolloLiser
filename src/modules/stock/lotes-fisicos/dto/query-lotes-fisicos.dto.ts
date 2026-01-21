import {
  IsBoolean,
  IsInt,
  IsOptional,
  Min,
  IsUUID,
  IsDateString,
} from 'class-validator';

export class QueryLotesFisicosDto {
  // ===== BaseEntity =====
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsDateString()
  created_desde?: string;

  @IsOptional()
  @IsDateString()
  created_hasta?: string;

  @IsOptional()
  @IsDateString()
  updated_desde?: string;

  @IsOptional()
  @IsDateString()
  updated_hasta?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  version_desde?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  version_hasta?: number;

  // ===== StockLote =====
  @IsOptional()
  @IsInt()
  producto_id?: number;

  @IsOptional()
  @IsInt()
  almacen_id?: number;

  @IsOptional()
  @IsBoolean()
  solo_con_stock?: boolean;

  @IsOptional()
  @IsBoolean()
  bloqueado?: boolean;

  @IsOptional()
  @IsDateString()
  fecha_desde?: string; // l.fecha_remito desde

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string; // l.fecha_remito hasta

  // ===== paginado =====
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

// src/caja/dto/query-panel-caja.dto.ts
import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPago } from '../enums/metodo-pago.enum';
import { TipoMovimiento } from '../enums/tipo-movimiento.enum';

export class QueryPanelCajaDto {
  // Si viene sucursalId, buscamos la apertura de esa sucursal (abierta o última en rango)
  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  // O directamente una apertura específica (recomendado si UI ya la tiene)
  @IsOptional()
  @IsUUID()
  aperturaId?: string;

  // Rango fechas (por fecha del movimiento)
  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;

  // Filtros
  @IsOptional()
  @IsEnum(TipoMovimiento)
  tipo?: TipoMovimiento;

  @IsOptional()
  @IsArray()
  @IsEnum(MetodoPago, { each: true })
  metodosPago?: MetodoPago[];

  @IsOptional()
  @IsString()
  usuario?: string;

  // Busca en referencia / usuario / id (ilike)
  @IsOptional()
  @IsString()
  q?: string;

  // Paginación
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  // Orden
  @IsOptional()
  @IsString()
  orderBy?: 'fecha' | 'montoTotal' = 'fecha';

  @IsOptional()
  @IsString()
  orderDir?: 'ASC' | 'DESC' = 'DESC';
}

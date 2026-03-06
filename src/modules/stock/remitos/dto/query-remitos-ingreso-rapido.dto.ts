// dto/query-remitos-ingreso-rapido.dto.ts
import { IsOptional, IsInt, Min, IsDateString, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryRemitosIngresoRapidoDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  proveedor_id?: number;

  // ✅ NUEVO: filtrar por producto_id (items)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  producto_id?: number;

  // ✅ opcional: buscar por texto (nombre/código comercial del producto)
  @IsOptional()
  @IsString()
  q_producto?: string;

  // por defecto solo pendientes
  @IsOptional()
  solo_pendientes?: 'true' | 'false';

  @IsOptional()
  @IsString()
  q_proveedor?: string;

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

// src/modules/stock/consultas/dto/query-lotes-por-producto.dto.ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class QueryLotesPorProductoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  producto_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  almacen_id?: number; // si viene: sólo lotes con stock en ese almacén

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC'; // por fecha_remito

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

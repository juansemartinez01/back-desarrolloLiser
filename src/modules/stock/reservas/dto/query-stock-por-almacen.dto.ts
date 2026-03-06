// src/reservas/dto/query-stock-por-almacen.dto.ts
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class QueryStockPorAlmacenDto {
  @Type(() => Number)
  @IsInt()
  almacen_id: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return ['true', '1', 'si', 'sí'].includes(String(value).toLowerCase());
  })
  solo_con_stock?: boolean;
}

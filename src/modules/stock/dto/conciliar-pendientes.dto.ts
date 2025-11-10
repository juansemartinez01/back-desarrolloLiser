import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ConciliarPendientesDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  producto_id?: number; // si no se envía, intenta con todos los productos en orden de antigüedad de pendientes

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  max_filas?: number; // limita cantidad de pendientes a procesar en un run (default 200)
}

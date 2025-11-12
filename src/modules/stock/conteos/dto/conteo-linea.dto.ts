import { Type } from 'class-transformer';
import { IsInt, IsNumber, Min } from 'class-validator';

export class ConteoLineaDto {
  @IsInt()
  producto_id: number;

  @IsInt()
  almacen_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidad_contada: number;
}

import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsPositive } from 'class-validator';

export class FraccionSalidaDto {
  @IsInt()
  producto_destino_id: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cantidad: number;
}

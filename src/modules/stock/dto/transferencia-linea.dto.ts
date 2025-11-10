import { Type } from "class-transformer";
import { IsInt, IsNumber, Min } from "class-validator";

export class TransferenciaLineaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  producto_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  almacen_origen_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  almacen_destino_id: number;
}

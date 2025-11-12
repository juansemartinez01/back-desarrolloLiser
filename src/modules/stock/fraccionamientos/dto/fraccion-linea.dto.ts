import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { FraccionSalidaDto } from './fraccion-salida.dto';

export class FraccionLineaDto {
  @IsUUID()
  lote_origen_id: string;

  @IsInt()
  producto_origen_id: number;

  @IsInt()
  almacen_id: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FraccionSalidaDto)
  salidas: FraccionSalidaDto[];
}

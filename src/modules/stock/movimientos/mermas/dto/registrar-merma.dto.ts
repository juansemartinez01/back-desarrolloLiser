// src/modules/stock/movimientos/mermas/dto/registrar-merma.dto.ts
import {
  IsArray,
  ArrayNotEmpty,
  IsInt,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class MermaLineaDto {
  @IsInt()
  producto_id: number;

  @IsInt()
  almacen_id: number;

  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @IsOptional()
  @IsUUID()
  lote_id?: string; // si viene, descuenta de ese lote; si no, FIFO
}

export class RegistrarMermaDto {
  @IsOptional()
  @IsString()
  fecha?: string; // ISO

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsArray()
  @ArrayNotEmpty()
  lineas: MermaLineaDto[];
}

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

export class VentaLineaDto {
  @IsInt()
  producto_id: number;

  @IsInt()
  almacen_id: number;

  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @IsOptional()
  @IsUUID()
  lote_id?: string; // si viene, consumo de ese lote; si no, FIFO
}

export class RegistrarVentaDto {
  @IsOptional()
  @IsString()
  fecha?: string; // ISO

  @IsOptional()
  @IsString()
  referencia_id?: string; // id de pedido / factura externa

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsArray()
  @ArrayNotEmpty()
  lineas: VentaLineaDto[];
}

import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class AjusteCambioDto {
  @IsString()
  @IsNotEmpty()
  referencia_venta_id: string; // Para trazabilidad

  @IsNumber()
  almacen_id: number;

  @IsArray()
  devoluciones: Array<{
    producto_id: number;
    cantidad: number;
    lote_id?: string;
  }>;

  @IsArray()
  entregas: Array<{
    producto_id: number;
    cantidad: number;
    lote_id?: string;
  }>;

  @IsOptional()
  observacion?: string;
}

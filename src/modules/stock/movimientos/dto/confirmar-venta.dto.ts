import { IsArray, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class ConfirmarVentaDto {
  @IsNumber()
  pedido_id: number;

  @IsArray()
  reservas_ids: number[];

  @IsArray()
  lineas: Array<{
    producto_id: number;
    cantidad: number;
    almacen_id: number;
    lote_id?: string;
  }>;

  @IsNumber()
  almacen_origen_id: number;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsOptional()
  @IsString()
  referencia_id?: string;

  @IsOptional()
  fecha?: string;

  @IsOptional()
  vacios?: Array<{
    envase_id: number;
    cantidad: number;
    precio_unitario?: number; // opcional (si querés snapshot)
  }>;

  @IsOptional()
  @IsUUID()
  cliente_id: string;
}

import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class EncontradoDto {
  @IsArray()
  lineas: Array<{
    producto_id: number;
    almacen_id: number;
    cantidad: number;
    lote_id?: string;
  }>;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsOptional()
  fecha?: string;
}

import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ReservarStockDto {
  @IsNumber()
  producto_id: number;

  @IsNumber()
  almacen_id: number;

  @IsNumber()
  cantidad: number;

  @IsOptional()
  @IsString()
  lote_id?: string;

  @IsOptional()
  @IsNumber()
  pedido_id?: number;
}

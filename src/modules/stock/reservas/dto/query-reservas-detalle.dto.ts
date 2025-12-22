import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryReservasDetalleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  almacen_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pedido_id?: number;

  @IsOptional()
  @IsString()
  estado?: 'RESERVADO' | 'CANCELADO' | 'CONSUMIDO';
}

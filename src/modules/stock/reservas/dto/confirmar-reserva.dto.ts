import { IsArray, IsNumber } from 'class-validator';

export class ConfirmarReservaDto {
  @IsArray()
  reservas_ids: number[];

  @IsNumber()
  pedido_id: number;
}

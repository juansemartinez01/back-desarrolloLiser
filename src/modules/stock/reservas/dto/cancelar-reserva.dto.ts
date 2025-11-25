import { IsNotEmpty, IsNumber } from 'class-validator';

export class CancelarReservaDto {
  @IsNumber()
  reserva_id: number;
}

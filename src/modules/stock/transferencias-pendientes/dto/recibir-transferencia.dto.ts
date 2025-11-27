import { IsUUID, IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class RecibirTransferenciaDto {
  @IsUUID()
  pendiente_id: string;

  @IsNumber()
  @Min(0)
  cantidad_recibida: number;

  @IsOptional()
  @IsString()
  observacion?: string;
}

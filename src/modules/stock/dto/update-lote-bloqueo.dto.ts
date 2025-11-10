import { IsBoolean } from 'class-validator';

export class UpdateLoteBloqueoDto {
  @IsBoolean()
  bloqueado: boolean;
}

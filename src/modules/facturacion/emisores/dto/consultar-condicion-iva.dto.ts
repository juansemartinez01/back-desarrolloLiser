import { IsInt } from 'class-validator';

export class ConsultarCondicionIvaDto {
  @IsInt()
  cuit_consulta: number;
}

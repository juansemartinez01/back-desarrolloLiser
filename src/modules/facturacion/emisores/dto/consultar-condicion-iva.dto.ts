import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ConsultarCondicionIvaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cuit_consulta: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cuit_computador: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cuit_representado: number;
}

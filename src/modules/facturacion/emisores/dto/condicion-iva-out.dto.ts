import { IsInt, IsString } from 'class-validator';

export class CondicionIvaOutDto {
  @IsInt()
  consulta: number;

  @IsString()
  condicion_iva: string;
}

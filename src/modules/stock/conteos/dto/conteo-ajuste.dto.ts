import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ConteoLineaDto } from './conteo-linea.dto';

export class ConteoAjusteDto {
  @IsDateString()
  fecha: string; // ISO

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConteoLineaDto)
  lineas: ConteoLineaDto[];
}

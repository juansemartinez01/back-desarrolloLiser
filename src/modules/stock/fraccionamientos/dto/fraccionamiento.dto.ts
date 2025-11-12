import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FraccionLineaDto } from './fraccion-linea.dto';

export class FraccionamientoDto {
  @IsDateString()
  fecha: string; // ISO8601

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FraccionLineaDto)
  lineas: FraccionLineaDto[];
}

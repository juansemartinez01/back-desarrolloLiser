import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngresoRapidoItemDto {
  @IsNumber()
  producto_id: number;

  @IsNumber()
  cantidad: number;

  @IsOptional()
  @IsString()
  unidad?: string;
}

export class IngresoRapidoRemitoDto {
  @IsOptional()
  @IsDateString()
  fecha?: string; // si no viene, usamos now()

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngresoRapidoItemDto)
  @IsNotEmpty()
  items: IngresoRapidoItemDto[];
}

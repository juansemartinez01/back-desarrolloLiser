// dto/ingreso-rapido-remito.dto.ts
import {
  IsArray,
  ArrayNotEmpty,
  IsInt,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngresoRapidoRemitoItemDto {
  @IsInt()
  producto_id: number; // A elige algo aproximado, B lo puede corregir

  @IsString()
  nombre_producto: string; // texto que escribe el Operario A

  @IsNumber()
  @Min(0.0001)
  cantidad_ingresada: number; // cantidad física real

  @IsNumber()
  @Min(0)
  cantidad_declarada: number; // lo que dice el papel

  @IsOptional()
  @IsString()
  presentacion?: string; // texto libre

  @IsOptional()
  @IsString()
  tamano?: string; // texto libre

  @IsOptional()
  @IsString()
  nota?: string;
}

export class IngresoRapidoRemitoDto {
  @IsOptional()
  @IsDateString()
  fecha?: string; // si no viene, usamos now()

  @IsOptional()
  @IsInt()
  proveedor_id?: number;

  @IsOptional()
  @IsString()
  proveedor_nombre?: string;

  @IsOptional()
  @IsString()
  conductor_camion?: string;

  @IsOptional()
  @IsString()
  observaciones?: string; // observación general del proveedor / remito

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => IngresoRapidoRemitoItemDto)
  items: IngresoRapidoRemitoItemDto[];
}

import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class FraccionLineaFactorDto {
  @IsUUID()
  lote_origen_id: string;

  @IsInt()
  @Min(1)
  producto_origen_id: number;

  @IsInt()
  @Min(1)
  almacen_id: number;

  // Unidades del producto origen que quiero transformar (ej: 60 cajones)
  @IsNumber()
  @Min(0.0001)
  cantidad_origen: number;

  @IsInt()
  @Min(1)
  producto_destino_id: number;

  // Factor de multiplicación de unidades (ej: 4 → 60 cajones → 240 cajitas)
  @IsNumber()
  @Min(0.0001)
  factor_unidades: number;
}

export class FraccionamientoFactorDto {
  @IsOptional()
  @IsString()
  fecha?: string; // ISO

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FraccionLineaFactorDto)
  lineas: FraccionLineaFactorDto[];
}

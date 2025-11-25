import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class FacturaItemDto {
  @IsOptional()
  @IsInt()
  Codigo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  Producto?: string;

  @IsInt()
  AlicuotaIVA: number; // tabla AFIP

  @IsOptional()
  @IsBoolean()
  Exento?: boolean;

  @IsOptional()
  @IsBoolean()
  Consignacion?: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  Cantidad: number;

  // Uno de los 2 es requerido
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  Precio_Unitario_Total?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  Precio_Unitario_Neto?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  IVA_Unitario?: number;
}

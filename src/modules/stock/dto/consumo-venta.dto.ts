import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class VentaLineaDto {
  @IsInt()
  @Min(1)
  producto_id: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_unitario?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  almacen_id?: number; // si se conoce el almacén origen de la venta
}
export class ConsumoVentaDto {
  @IsDateString()
  fecha: string; // ISO8601; ej: "2025-09-19T12:00:00Z"

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  referencia_venta_id: string; // id externo del documento (idempotencia)

  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VentaLineaDto)
  lineas: VentaLineaDto[];
}
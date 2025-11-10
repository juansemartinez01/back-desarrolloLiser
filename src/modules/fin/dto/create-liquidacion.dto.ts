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
  IsUUID,
} from 'class-validator';

export class CrearLiquidacionDetalleDto {
  @IsUUID() remito_id: string;

  @IsOptional() @IsUUID() remito_item_id?: string;

  @IsInt() @Min(1) producto_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidad_base: number; // cuánta cantidad vendida usás de base (para control)

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monto_pago: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notas?: string;
}

export class CrearLiquidacionDto {
  @IsInt() @Min(1) proveedor_id: number;

  @IsDateString() fecha: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referencia_externa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearLiquidacionDetalleDto)
  detalles: CrearLiquidacionDetalleDto[];
}

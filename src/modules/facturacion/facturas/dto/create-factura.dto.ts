import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayNotEmpty,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FacturaItemDto } from './item.dto';

export class CreateFacturaDto {
  // Emisor
  @IsUUID()
  emisor_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia_interna?: string; // para idempotencia

  // Receptor
  @IsOptional()
  @IsString()
  @MaxLength(200)
  razon_social_receptor?: string;

  @IsOptional()
  @IsInt()
  doc_tipo?: number; // 99

  @IsOptional()
  @IsInt()
  doc_nro?: number;

  @IsOptional()
  @IsInt()
  cond_iva_receptor?: number; // 5 CF

  // Comprobante
  @IsOptional()
  @IsInt()
  factura_tipo?: number; // 11 C, 1 A, 6 B

  @IsOptional()
  @IsInt()
  punto_venta?: number; // 1

  @IsOptional()
  @IsInt()
  concepto?: number; // 1

  // Moneda
  @IsOptional()
  @IsString()
  @MaxLength(3)
  moneda?: string; // "PES"

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cotizacion?: number; // 1

  // Totales alternativos (opcional, se recalculan)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  importe_no_gravado?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  importe_exento?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  importe_tributos?: number;

  @IsOptional()
  @IsString()
  codigo_operacion_exento?: string;

  // NC/ND referencia
  @IsOptional()
  @IsInt()
  tipo_comprobante_original?: number;

  @IsOptional()
  @IsInt()
  pto_venta_original?: number;

  @IsOptional()
  @IsInt()
  nro_comprobante_original?: number;

  @IsOptional()
  @IsInt()
  cuit_receptor_comprobante_original?: number;

  // Items
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FacturaItemDto)
  lista_productos: FacturaItemDto[];

  // Modo test (override)
  @IsOptional()
  @IsBoolean()
  test?: boolean;
}

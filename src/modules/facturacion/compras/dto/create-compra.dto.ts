import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  IsBoolean,
  IsIn,
  IsPositive,
  ValidateIf,
} from 'class-validator';

export class CreateCompraDto {
  // Identificación del comprobante recibido
  @IsInt() fecha_emision: number; // YYYYMMDD
  @IsInt() comprobante_tipo: number; // AFIP
  @IsInt() punto_venta: number;
  @IsInt() nro_comprobante: number;
  @IsInt() cae: number;

  // Clasificación (1: Bien de Uso, 2: Compra, 3: Gasto)
  @IsInt() @IsIn([1, 2, 3]) clasificacion: number;

  // Proveedor
  @IsInt() doc_tipo_vendedor: number; // 80 CUIT, 96 DNI, 99 CF
  @IsInt() doc_nro_vendedor: number;
  @IsString() @MaxLength(200) nombre_vendedor: string;

  // Importación (si aplica)
  @IsOptional() @IsString() @MaxLength(40) despacho_importacion?: string;

  // Totales
  @Type(() => Number) @IsNumber() @IsPositive() importe_total: number;
  @Type(() => Number) @IsNumber() importe_no_gravado: number;
  @Type(() => Number) @IsNumber() importe_exento: number;
  @Type(() => Number) @IsNumber() percep_iva: number;
  @Type(() => Number) @IsNumber() percep_otros_nacionales: number;
  @Type(() => Number) @IsNumber() percep_iibb: number;
  @Type(() => Number) @IsNumber() percep_municipales: number;
  @Type(() => Number) @IsNumber() impuestos_internos: number;

  // IVA por alícuotas
  @Type(() => Number) @IsNumber() Neto_0: number;
  @Type(() => Number) @IsNumber() Neto_025: number;
  @Type(() => Number) @IsNumber() IVA_025: number;
  @Type(() => Number) @IsNumber() Neto_05: number;
  @Type(() => Number) @IsNumber() IVA_05: number;
  @Type(() => Number) @IsNumber() Neto_105: number;
  @Type(() => Number) @IsNumber() IVA_105: number;
  @Type(() => Number) @IsNumber() Neto_21: number;
  @Type(() => Number) @IsNumber() IVA_21: number;
  @Type(() => Number) @IsNumber() Neto_27: number;
  @Type(() => Number) @IsNumber() IVA_27: number;

  // Moneda
  @IsString() @MaxLength(3) moneda: string; // PES
  @Type(() => Number) @IsNumber() cotizacion: number;

  // IVA y código de operación
  @IsString() @MaxLength(3) codigo_operacion_exento: string;

  // Crédito fiscal / otros
  @Type(() => Number) @IsNumber() credito_fiscal_computable: number;
  @Type(() => Number) @IsNumber() otros_tributos: number;

  // Intermediación (si aplica)
  @IsBoolean() intermediacion_tercero: boolean;
  @ValidateIf((o) => o.intermediacion_tercero)
  @IsOptional()
  @IsInt()
  cuit_emisor_corredor?: number;
  @ValidateIf((o) => o.intermediacion_tercero)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  denom_emisor_corredor?: string;
  @Type(() => Number) @IsNumber() iva_comision: number;

  // Nota crédito/débito recibida (si aplica referenciar original)
  @IsOptional() @IsInt() tipo_comprobante_original?: number;
  @IsOptional() @IsInt() pto_venta_original?: number;
  @IsOptional() @IsInt() nro_comprobante_original?: number;

  // Idempotencia sugerida (opcional): referencia interna propia
  @IsOptional() @IsString() @MaxLength(120) referencia_interna?: string;

  // Flags
  @IsOptional() @IsBoolean() test?: boolean;
}

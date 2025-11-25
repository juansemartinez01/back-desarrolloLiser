import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class LiqItemDto {
  @IsOptional() @IsInt() Codigo?: number;
  @IsOptional() @IsString() @MaxLength(300) Producto?: string;
  @IsInt() AlicuotaIVA: number; // 3,4,5,6,8 etc (AFIP)
  @IsOptional() Exento?: boolean; // si es exento => AlicuotaIVA 3
  @IsOptional() Consignacion?: boolean; // true si corresponde
  @Type(() => Number) @IsNumber() @Min(0.000001) Cantidad: number;
  @IsOptional() @Type(() => Number) @IsNumber() Precio_Unitario_Total?: number;
  @IsOptional() @Type(() => Number) @IsNumber() Precio_Unitario_Neto?: number;
  @IsOptional() @Type(() => Number) @IsNumber() IVA_Unitario?: number;
}

export class CreateLiquidacionDto {
  // Identificación / idempotencia
  @IsUUID() emisor_id: string;
  @IsOptional() @IsString() @MaxLength(120) referencia_interna?: string;

  // Modo: electrónica vs manual
  @IsBoolean() electronica: boolean;
  @IsOptional() @IsString() token?: string; // si electronica = true
  @IsOptional() @IsString() sign?: string; // si electronica = true

  // Manual (CAI)
  @IsOptional() @IsInt() comprobante_nro?: number;

  // Encabezado AFIP
  @IsOptional() @IsInt() @IsIn([63, 64]) factura_tipo?: number; // 63=A, 64=B
  @IsOptional() @IsInt() punto_venta?: number;
  @IsOptional() @IsInt() metodo_pago?: number;
  @IsOptional() @IsInt() concepto?: number; // 1/2/3
  @IsOptional() @IsInt() nro_remito?: number;
  @IsOptional() @IsInt() fecha_liquidacion?: number; // YYYYMMDD (si no va, se setea en service)
  @IsOptional() @IsInt() fecha_inicio_servicios?: number; // YYYYMMDD
  @IsOptional() @IsInt() fecha_fin_servicios?: number; // YYYYMMDD
  @IsOptional() @IsInt() fecha_vto_pago?: number; // YYYYMMDD

  // Moneda
  @IsOptional() @IsString() @MaxLength(3) moneda?: string; // PES
  @IsOptional() @Type(() => Number) @IsNumber() cotizacion?: number; // 1.0
  @IsOptional() @IsString() @MaxLength(1) moneda_pago?: string; // 'N'/'S'

  // Receptor
  @IsString() @MaxLength(200) razon_social_receptor: string;
  @IsOptional() @IsString() @MaxLength(300) domicilio_receptor?: string;
  @IsInt() doc_tipo: number; // 80 CUIT, 96 DNI, 99 CF
  @IsInt() doc_nro: number;
  @IsInt() cond_iva_receptor: number;

  // Items
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LiqItemDto)
  lista_productos: LiqItemDto[];

  // Comisión
  @Type(() => Number) @IsNumber() @Min(0) porcentaje_comision: number; // ej 0.12

  // Exentos
  @IsOptional() @IsString() @MaxLength(3) codigo_operacion_exento?: string;

  // Flags
  @IsOptional() @IsBoolean() test?: boolean;
}

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

class NotaItemDto {
  @IsOptional() @IsInt() Codigo?: number;
  @IsOptional() @IsString() @MaxLength(300) Producto?: string;
  @IsInt() AlicuotaIVA: number; // AFIP code (3,4,5,6,8 etc.)
  @IsOptional() IsBoolean?: boolean; // ignorado si usás Exento
//   @IsOptional() IsBoolean?: boolean; // ignorado si usás Consignacion
  @Type(() => Number) @IsNumber() @Min(0.000001) Cantidad: number;
  @IsOptional() @Type(() => Number) @IsNumber() Precio_Unitario_Total?: number;
  @IsOptional() @Type(() => Number) @IsNumber() Precio_Unitario_Neto?: number;
  @IsOptional() @Type(() => Number) @IsNumber() IVA_Unitario?: number;
  @IsOptional() Exento?: boolean;
  @IsOptional() Consignacion?: boolean;
}

export class CreateNotaDto {
  // Emisor (mismo de la original)
  @IsUUID() emisor_id: string;

  // Identificación de la FACTURA original (una de las dos formas)
  @IsOptional() @IsUUID() factura_original_id?: string; // atajo por id local
  @IsOptional() @IsInt() tipo_comprobante_original?: number; // ej 1/6/11
  @IsOptional() @IsInt() pto_venta_original?: number;
  @IsOptional() @IsInt() nro_comprobante_original?: number;
  @IsOptional() @IsInt() cuit_receptor_comprobante_original?: number;

  // Referencia interna para idempotencia (opcional, pero recomendado)
  @IsOptional() @IsString() @MaxLength(100) referencia_interna?: string;

  // Receptor (si querés override; si no, se toma de la original)
  @IsOptional() @IsString() @MaxLength(200) razon_social_receptor?: string;
  @IsOptional() @IsInt() doc_tipo?: number;
  @IsOptional() @IsInt() doc_nro?: number;
  @IsOptional() @IsInt() cond_iva_receptor?: number;

  // Comprobante (si no lo mandás, se infiere según la original)
  @IsOptional() @IsInt() factura_tipo?: number; // 3/8/13 para NC, 2/7/12 para ND
  @IsOptional() @IsInt() punto_venta?: number;

  // Motivo libre / observación
  @IsOptional() @IsString() @MaxLength(1000) observacion?: string;

  // Ítems (obligatorio: lista concreta a acreditar o debitar)
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => NotaItemDto)
  lista_productos: NotaItemDto[];

  // Moneda y demás (opcional)
  @IsOptional() @IsString() @MaxLength(3) moneda?: string; // PES
  @IsOptional() @Type(() => Number) @IsNumber() cotizacion?: number; // 1
  @IsOptional() @IsBoolean() test?: boolean;

  // Exentos (si corresponde)
  @IsOptional() @IsString() codigo_operacion_exento?: string;
}

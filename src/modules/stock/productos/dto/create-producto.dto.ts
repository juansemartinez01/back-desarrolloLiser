// src/modules/stock/productos/dto/create-producto.dto.ts
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProductoDto {
  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsNumber()
  @IsOptional()
  precio_base?: number;

  @IsInt()
  unidad_id: number;

  @IsInt()
  tipo_producto_id: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  vacio?: boolean;

  @IsOptional()
  @IsBoolean()
  oferta?: boolean;

  @IsOptional()
  @IsNumber()
  precio_oferta?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  imagen?: string;

  @IsOptional()
  @IsNumber()
  precio_vacio?: number;

  @IsOptional()
  @IsString()
  id_interno?: string;

  @IsOptional()
  @IsString()
  empresa?: string;

  @IsOptional()
  @IsInt()
  proveedor_id?: number | null;

  /** --------------------
   * ADMINISTRATIVOS
   * ------------------- */

  @IsNumberString()
  @IsOptional()
  alicuota_iva?: string; // ej 21, 10.5

  @IsBoolean()
  @IsOptional()
  exento_iva?: boolean;

  @IsNumberString()
  @IsOptional()
  precio_compra?: string;

  @IsNumberString()
  @IsOptional()
  precio_sin_iva?: string;

  @IsNumberString()
  @IsOptional()
  precio_con_iva?: string;

  @IsInt()
  @IsOptional()
  selector_fiscal?: number;
}

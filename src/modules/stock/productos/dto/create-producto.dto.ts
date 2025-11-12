// src/modules/stock/productos/dto/create-producto.dto.ts
import {
  IsBoolean,
  IsInt,
  IsNumber,
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
  @IsInt()
  id_interno?: number;

  @IsOptional()
  @IsString()
  empresa?: string;

  @IsOptional()
  @IsInt()
  proveedor_id?: number | null;
}

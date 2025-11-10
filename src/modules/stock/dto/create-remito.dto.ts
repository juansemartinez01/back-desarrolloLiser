import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
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

export class CreateRemitoItemDto {
  @IsInt() @Min(1) producto_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unidad?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cantidad_total: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidad_tipo1: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidad_tipo2: number;

  @IsIn(['GLADIER', 'SAYRUS'])
  empresa_factura: 'GLADIER' | 'SAYRUS';
}

export class CreateRemitoDto {
  @IsDateString() fecha_remito: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  numero_remito: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  proveedor_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  proveedor_nombre?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRemitoItemDto)
  items: CreateRemitoItemDto[];
}

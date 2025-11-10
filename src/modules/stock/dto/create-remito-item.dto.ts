import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmpresaFactura } from '../enums/empresa-factura.enum';

export class CreateRemitoItemDto {
  @IsInt()
  @Min(1)
  producto_id: number;

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

  @IsEnum(EmpresaFactura)
  empresa_factura: EmpresaFactura;
}

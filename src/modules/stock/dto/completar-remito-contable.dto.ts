// src/modules/stock/dto/completar-remito-contable.dto.ts
import {
  IsArray,
  IsOptional,
  IsInt,
  IsString,
  MaxLength,
  IsUUID,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmpresaFactura } from '../enums/empresa-factura.enum';

export class CompletarRemitoItemContableDto {
  @IsUUID()
  remito_item_id: string;

  // Split contable
  @IsOptional()
  @IsNumber()
  cantidad_tipo1?: number;

  @IsOptional()
  @IsNumber()
  cantidad_tipo2?: number;

  // Cantidad que dice el remito/factura (opcional)
  @IsOptional()
  @IsNumber()
  cantidad_remito?: number;

  @IsOptional()
  empresa_factura?: EmpresaFactura;
}

export class CompletarRemitoContableDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  numero_remito?: string;

  @IsOptional()
  @IsInt()
  proveedor_id?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  proveedor_nombre?: string | null;

  @IsOptional()
  @IsString()
  observaciones?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletarRemitoItemContableDto)
  items: CompletarRemitoItemContableDto[];
}

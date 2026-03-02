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
import { EmpresaFactura } from '../../enums/empresa-factura.enum';
import { ItemsMoveDto } from './items-move.dto';
import { AddRemitoItemDto } from './item-add-remito.dto';

export class CompletarRemitoItemContableDto {
  @IsUUID()
  remito_item_id: string;

  @IsOptional()
  @IsInt()
  producto_id?: number; // producto REAL elegido por B

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unidad?: string; // si no viene, se autocompleta desde producto.unidad_id

  @IsOptional()
  @IsNumber()
  cantidad_remito?: number; // lo que dice el papel

  @IsOptional()
  empresa_factura?: EmpresaFactura; // GLADIER / SAYRUS
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

  @IsOptional()
  @IsArray()
  // uuid[] (si querés validación, agregale IsUUID('4',{each:true}))
  items_remove?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddRemitoItemDto)
  items_add?: AddRemitoItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ItemsMoveDto)
  items_move?: ItemsMoveDto;
}



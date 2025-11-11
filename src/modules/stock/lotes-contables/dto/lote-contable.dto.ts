// src/modules/stock/lotes-contables/dto/lote-contable.dto.ts
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  IsInt,
} from 'class-validator';
import { EmpresaFactura } from '../../enums/empresa-factura.enum';
import { LoteContableEstado } from '../../enums/lote-contable-estado.enum';

export class CreateLoteContableDto {
  @IsUUID()
  lote_id: string;

  @IsNumber()
  @Min(0.0001)
  cantidad_total: number;

  @IsNumber()
  @Min(0)
  cantidad_tipo1: number;

  @IsNumber()
  @Min(0)
  cantidad_tipo2: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_vendida?: number; // opcional, por defecto 0

  @IsString()
  @MaxLength(20)
  empresa_factura: EmpresaFactura;
}

export class UpdateLoteContableDto {
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  cantidad_total?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_tipo1?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_tipo2?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_vendida?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  empresa_factura?: EmpresaFactura;
}

export class QueryLoteContableDto {
  @IsOptional()
  @IsUUID()
  lote_id?: string;

  @IsOptional()
  @IsEnum(LoteContableEstado)
  estado?: LoteContableEstado;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

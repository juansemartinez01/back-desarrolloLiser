// src/modules/stock/dto/seleccionar-tipo1.dto.ts
import {
  IsArray,
  ArrayNotEmpty,
  IsInt,
  IsNumber,
  IsPositive,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmpresaFactura } from '../../enums/empresa-factura.enum';
import { LoteContableEstado } from '../../enums/lote-contable-estado.enum';

export class SeleccionarTipo1Dto {
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  producto_ids: number[];

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  monto_objetivo: number;

  @IsOptional()
  empresa_factura?: EmpresaFactura;

  @IsOptional()
  estado?: LoteContableEstado;

  @IsOptional()
  desde?: string; // ISO date

  @IsOptional()
  hasta?: string; // ISO date
}

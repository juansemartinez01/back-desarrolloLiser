import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  IsUUID,
  IsNumber,
} from 'class-validator';
import { PagoEstado } from '../entities/pago.entity';

export class PagoAplicItemDto {
  @IsUUID() liquidacion_id: string;
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monto: number;
}

export class CrearPagoDto {
  @IsInt() @Min(1) proveedor_id: number;
  @IsDateString() fecha: string;

  @IsOptional() @IsString() @MaxLength(120) referencia_externa?: string;
  @IsOptional() @IsString() @MaxLength(255) observacion?: string;

  // Si no viene monto_total, se toma la suma de aplicaciones
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monto_total?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoAplicItemDto)
  aplicaciones?: PagoAplicItemDto[];
}

export class AplicarPagoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoAplicItemDto)
  aplicaciones: PagoAplicItemDto[];
}

export class QueryPagosDto {
  @IsOptional() @IsInt() @Min(1) proveedor_id?: number;
  @IsOptional() @IsEnum(PagoEstado) estado?: PagoEstado;
  @IsOptional() @IsString() desde?: string;
  @IsOptional() @IsString() hasta?: string;
  @IsOptional() @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsString() order?: 'ASC' | 'DESC';
}

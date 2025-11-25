import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryLiquidacionesDto {
  @IsOptional() @IsUUID() emisor_id?: string;
  @IsOptional() @IsBoolean() electronica?: boolean;
  @IsOptional() @IsInt() punto_venta?: number;
  @IsOptional() @IsInt() factura_tipo?: number;
  @IsOptional() @IsString() referencia_interna?: string;

  @IsOptional() @IsString() desde?: string; // ISO date
  @IsOptional() @IsString() hasta?: string; // ISO date

  @IsOptional() @IsIn(['ASC', 'DESC']) order?: 'ASC' | 'DESC';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}

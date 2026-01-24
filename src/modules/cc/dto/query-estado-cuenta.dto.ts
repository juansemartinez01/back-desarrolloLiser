import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { PagoCuenta } from '../enums/pago-cuenta.enum';

export class QueryEstadoCuentaDto {
  @IsUUID()
  cliente_id: string;

  @IsOptional()
  @IsDateString()
  desde?: string; // ISO; filtro inclusivo (>=)

  @IsOptional()
  @IsDateString()
  hasta?: string; // ISO; filtro exclusivo (<)

  @IsOptional()
    @IsEnum(PagoCuenta)
    cuenta?: PagoCuenta;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC'; // default ASC

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number; // default 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number; // default 100
}

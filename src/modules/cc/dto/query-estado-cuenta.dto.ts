import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

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

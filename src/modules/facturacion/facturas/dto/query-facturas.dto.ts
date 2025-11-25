import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryFacturasDto {
  @IsOptional()
  @IsUUID()
  emisor_id?: string;

  @IsOptional()
  @IsString()
  referencia_interna?: string;

  @IsOptional()
  @IsIn(['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'ERROR'])
  estado?: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'ERROR';

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

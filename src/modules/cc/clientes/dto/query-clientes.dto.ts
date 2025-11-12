// src/modules/cc/clientes/dto/query-clientes.dto.ts
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryClientesDto {
  @IsOptional()
  @IsString()
  search?: string; // ILIKE sobre nombre / fantasia / dni_cuit / externo / email / teléfono

  @IsOptional()
  @IsBooleanString()
  activo?: 'true' | 'false';

  @IsOptional()
  @IsIn(['nombre', 'created_at', 'updated_at'])
  orderBy?: 'nombre' | 'created_at' | 'updated_at';

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

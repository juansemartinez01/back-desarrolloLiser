import { IsInt, IsOptional, IsString, Max, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryProveedoresDto {
  @IsOptional()
  @IsString()
  q?: string; // busca por nombre/cuit

  @IsOptional()
  @IsIn(['true', 'false'])
  activo?: string; // string para query param

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

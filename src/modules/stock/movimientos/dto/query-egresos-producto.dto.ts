// dto/query-egresos-producto.dto.ts
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryEgresosProductoDto {
  @IsString()
  desde: string; // ISO

  @IsString()
  hasta: string; // ISO

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  almacen_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  producto_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

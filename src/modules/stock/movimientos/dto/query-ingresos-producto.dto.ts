import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class QueryIngresosProductoDto {
  @IsDateString()
  desde: string;

  @IsDateString()
  hasta: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  almacen_id?: number;

  @IsOptional()
  @IsInt()
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

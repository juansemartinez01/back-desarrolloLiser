import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAjustesConteoProductoDto {
  @IsDateString()
  desde: string; // ISO

  @IsDateString()
  hasta: string; // ISO (exclusivo)

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

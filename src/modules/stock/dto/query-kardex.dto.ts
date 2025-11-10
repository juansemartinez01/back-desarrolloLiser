import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class QueryKardexDto extends PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  producto_id: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  almacen_id?: number; // si se especifica, filtra por almacén

  @IsOptional()
  @IsDateString()
  desde?: string; // ISO8601

  @IsOptional()
  @IsDateString()
  hasta?: string; // ISO8601 (exclusivo si querés día siguiente 00:00)
}

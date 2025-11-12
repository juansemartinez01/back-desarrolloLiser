import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class QueryVentasProductoDto {
  // rango de fecha/hora (incluye hora)
  @IsDateString()
  desde: string; // ej 2025-11-12T00:00:00Z

  @IsDateString()
  hasta: string; // ej 2025-11-13T00:00:00Z

  @IsOptional()
  @IsInt()
  almacen_id?: number;

  @IsOptional()
  @IsInt()
  producto_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class QueryLotesFisicosDto {
  @IsOptional()
  @IsInt()
  producto_id?: number;

  @IsOptional()
  @IsInt()
  almacen_id?: number;

  @IsOptional()
  @IsBoolean()
  solo_con_stock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

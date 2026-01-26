import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryBackofficeLotesFisicosDto {
  @IsOptional() @IsString() id?: string;

  @IsOptional() @IsString() created_desde?: string;
  @IsOptional() @IsString() created_hasta?: string;

  @IsOptional() @IsString() updated_desde?: string;
  @IsOptional() @IsString() updated_hasta?: string;

  @IsOptional() @IsInt() version?: number;
  @IsOptional() @IsInt() version_desde?: number;
  @IsOptional() @IsInt() version_hasta?: number;

  @IsOptional() @IsInt() producto_id?: number;

  @IsOptional() @IsBoolean() bloqueado?: boolean;

  @IsOptional() @IsBoolean() solo_con_stock?: boolean;

  @IsOptional() @IsString() fecha_desde?: string;
  @IsOptional() @IsString() fecha_hasta?: string;

  @IsOptional() @IsInt() almacen_id?: number;

  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) limit?: number;
}

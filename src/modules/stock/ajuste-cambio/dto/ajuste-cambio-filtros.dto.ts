import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class AjusteCambioFiltrosDto {
  @IsOptional()
  @IsString()
  referencia_venta_id?: string;

  @IsOptional()
  @IsString()
  fecha_desde?: string; // ISO 8601 o yyyy-mm-dd

  @IsOptional()
  @IsString()
  fecha_hasta?: string;

  @IsOptional()
  @IsNumberString()
  producto_id?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}

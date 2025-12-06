import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateProductoAdminDto {
  @IsOptional()
  @IsNumber()
  precio_compra?: number;

  @IsOptional()
  @IsNumber()
  precio_sin_iva?: number;

  @IsOptional()
  @IsNumber()
  precio_con_iva?: number;

  @IsOptional()
  @IsNumber()
  alicuota_iva?: number;

  @IsOptional()
  @IsString()
  categoria_fiscal?: string;

  @IsOptional()
  @IsBoolean()
  facturable?: boolean;

  @IsOptional()
  @IsString()
  empresa?: string;
}

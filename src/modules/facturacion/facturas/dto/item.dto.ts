// dto/item.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class FacturaItemDto {
  @IsInt()
  ProductoId: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  Cantidad: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  Precio_Unitario_Total?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  Precio_Unitario_Neto?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  IVA_Unitario?: number;
}

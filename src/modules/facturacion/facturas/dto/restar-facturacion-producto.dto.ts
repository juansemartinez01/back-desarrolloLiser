import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RestarFacturacionProductoDto {
  @Type(() => Number)
  @IsInt()
  producto_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  cantidad: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}

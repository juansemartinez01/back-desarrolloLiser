import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class VacioItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  envase_id: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_unitario?: number;
}

export class RegistrarEntregaPedidoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cliente_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  pedido_id: number;

  @IsOptional()
  @IsString()
  pedido_codigo?: string; // "PED-...." (dto.referencia_id)

  @IsOptional()
  @IsString()
  fecha?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VacioItemDto)
  items: VacioItemDto[];
}

import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddRemitoItemDto {
  @IsInt()
  @IsPositive()
  producto_id: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cantidad_ingresada: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidad_declarada?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre_producto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  presentacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tamano?: string;

  @IsOptional()
  @IsString()
  nota?: string;

  @IsOptional()
  @IsBoolean()
  pallet_descarga?: boolean;

  @IsOptional()
  @IsIn(['COMPLETO', 'PARCIAL'])
  pallet_estado?: 'COMPLETO' | 'PARCIAL';
}

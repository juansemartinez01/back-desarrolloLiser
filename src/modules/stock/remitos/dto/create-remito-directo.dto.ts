import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateRemitoDirectoItemDto {
  @IsInt()
  @Min(1)
  producto_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  cantidad_ingresada: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidad_declarada: number;
}

export class CreateRemitoDirectoDto {
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsString()
  @MaxLength(80)
  numero_remito: string; // REAL (papel)

  @IsInt()
  proveedor_id: number; // en tu caso siempre 1

  @IsOptional()
  @IsString()
  @MaxLength(200)
  proveedor_nombre?: string;

  @IsUUID()
  conductor_camion_id: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsInt()
  almacen_id?: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateRemitoDirectoItemDto)
  items: CreateRemitoDirectoItemDto[];
}

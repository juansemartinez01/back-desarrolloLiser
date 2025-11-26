// dto/ingreso-rapido-remito.dto.ts
import {
  IsArray,
  ArrayNotEmpty,
  IsInt,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  IsDateString,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngresoRapidoRemitoItemDto {
  @IsInt()
  producto_id: number;

  @IsString()
  nombre_producto: string;

  @IsNumber()
  @Min(0.0001)
  cantidad_ingresada: number;

  @IsNumber()
  @Min(0)
  cantidad_declarada: number;

  @IsOptional()
  @IsString()
  presentacion?: string;

  @IsOptional()
  @IsString()
  tamano?: string;

  @IsOptional()
  @IsString()
  nota?: string;
}

export class IngresoRapidoRemitoDto {
  @IsOptional()
  @IsDateString()
  fecha?: string;

  // 👇 ahora obligatorio: se elige de un selector
  @IsInt()
  proveedor_id: number;

  @IsOptional()
  @IsString()
  proveedor_nombre?: string; // opcional: podés no mandarlo

  // 👇 referencia a la nueva tabla de conductores
  @IsUUID()
  conductor_camion_id: string;

  @IsOptional()
  @IsInt()
  almacen_id?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => IngresoRapidoRemitoItemDto)
  items: IngresoRapidoRemitoItemDto[];
}

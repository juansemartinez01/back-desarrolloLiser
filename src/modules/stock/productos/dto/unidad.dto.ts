// src/modules/stock/productos/dto/unidad.dto.ts
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateUnidadDto {
  @IsString()
  @MaxLength(50)
  codigo: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  abreviatura?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateUnidadDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  abreviatura?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class QueryUnidadDto {
  @IsOptional()
  @IsString()
  search?: string; // busca en codigo / nombre / abreviatura

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

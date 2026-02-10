import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProveedorDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number; // opcional para permitir alineación externa

  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cuit?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  external_ref?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  domicilio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  localidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cond_iva?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  telefonos?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  estado?: string;
}

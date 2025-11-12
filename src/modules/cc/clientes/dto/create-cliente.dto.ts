// src/modules/cc/clientes/dto/create-cliente.dto.ts
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre: string; // razón social / nombre

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre_fantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  dni_cuit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  externo_codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean; // default true si no viene
}

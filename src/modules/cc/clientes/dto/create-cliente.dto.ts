// src/modules/cc/clientes/dto/create-cliente.dto.ts
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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

  // ✅ NUEVO: topes de deuda (por cuenta). Default en DB = 0
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tope_deuda_cuenta1?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tope_deuda_cuenta2?: number;
}

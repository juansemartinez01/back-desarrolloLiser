// src/caja/dto/cierre.dto.ts
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CerrarCajaDto {
  @IsNumber()
  totalRealEfectivo: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsString()
  usuario: string;
}

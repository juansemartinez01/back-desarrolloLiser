// src/caja/dto/apertura.dto.ts
import { IsNumber, IsString } from 'class-validator';

export class AperturaDto {
  @IsNumber()
  saldoInicial: number;

  @IsString()
  usuario: string;

  @IsString()
  sucursalId: string;
}

// src/modules/backoffice/cc/pagos/dto/bo-create-pago.dto.ts
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class BoCreatePagoDto {
  @IsDateString()
  fecha: string;

  @IsUUID()
  cliente_id: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  importe_total: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia_externa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;
}

import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePagoDto {
  @IsDateString()
  fecha: string; // ISO 8601

  @IsUUID()
  cliente_id: string;

  @IsIn(['CUENTA1', 'CUENTA2'])
  cuenta: 'CUENTA1' | 'CUENTA2';

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  importe_total: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia_externa?: string; // nro recibo/transferencia, opcional

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;
}

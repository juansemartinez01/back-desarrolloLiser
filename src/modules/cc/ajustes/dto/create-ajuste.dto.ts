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

export class CreateAjusteDto {
  @IsDateString()
  fecha: string; // ISO 8601

  @IsUUID()
  cliente_id: string;

  @IsIn(['NC', 'ND'])
  tipo: 'NC' | 'ND';

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monto_total: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia_externa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;
}

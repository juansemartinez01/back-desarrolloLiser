import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsNumber,
  IsPositive,
} from 'class-validator';

export class CreateCargoDto {
  @IsDateString()
  fecha: string; // ISO 8601

  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string; // ISO 8601 (opcional)

  @IsUUID()
  cliente_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  venta_ref_tipo: string; // p.ej. 'VENTA' (default en DB)

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  venta_ref_id: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  importe: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;
}

export class CreateCargosBulkDto {
  items: CreateCargoDto[];
}

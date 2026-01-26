// src/modules/backoffice/cc/cargos/dto/bo-create-cargo.dto.ts
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

export class BoCreateCargoDto {
  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string;

  @IsUUID()
  cliente_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  venta_ref_tipo: string;

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

export class BoCreateCargosBulkDto {
  items: BoCreateCargoDto[];
}

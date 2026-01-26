// src/modules/backoffice/cc/ajustes/dto/bo-create-ajuste.dto.ts
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { AjusteTipo } from '../../../../../modules/cc/enums/ajuste-tipo.enum';

export class BoCreateAjusteDto {
  @IsDateString()
  fecha: string;

  @IsUUID()
  cliente_id: string;

  @IsEnum(AjusteTipo) // 'NC' | 'ND'
  tipo: AjusteTipo;

  @IsNumber()
  @Min(0.0001)
  monto_total: number;

  @IsOptional()
  @IsString()
  referencia_externa?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}

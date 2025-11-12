import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { LoteTipo } from '../../enums/lote-tipo.enum';

export class DistribucionPorAlmacenDto {
  @IsInt()
  @Min(1)
  almacen_id: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @IsOptional()
  @IsUUID()
  lote_id?: string;

  @IsOptional()
  @IsEnum(LoteTipo)
  prefer_tipo?: LoteTipo; // solo si no se especifica lote_id
}

export class DistribucionItemDto {
  @IsInt()
  @Min(1)
  producto_id: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DistribucionPorAlmacenDto)
  distribuciones: DistribucionPorAlmacenDto[];
}

export class CreateDistribucionRemitoDto {
  @IsOptional()
  @IsDateString()
  fecha?: string; // default: now

  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DistribucionItemDto)
  items: DistribucionItemDto[];
}

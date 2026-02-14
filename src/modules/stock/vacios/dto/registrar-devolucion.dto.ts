import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class RegistrarDevolucionDto {
  @IsString()
  cliente_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  envase_id: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}

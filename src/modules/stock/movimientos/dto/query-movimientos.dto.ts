import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MovimientoTipo } from '../../enums/movimiento-tipo.enum';

export class QueryMovimientosDto {
  @IsOptional()
  @IsEnum(MovimientoTipo)
  tipo?: MovimientoTipo;

  @IsOptional()
  @IsDateString()
  desde?: string; // fecha >=

  @IsOptional()
  @IsDateString()
  hasta?: string; // fecha <

  @IsOptional()
  @IsInt()
  almacen_origen_id?: number;

  @IsOptional()
  @IsInt()
  almacen_destino_id?: number;

  @IsOptional()
  @IsInt()
  producto_id?: number;

  @IsOptional()
  @IsString()
  referencia_tipo?: string;

  @IsOptional()
  @IsString()
  referencia_id?: string;

  @IsOptional()
  @IsString()
  search?: string; // busca en observacion

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  order?: 'ASC' | 'DESC'; // por fecha
}

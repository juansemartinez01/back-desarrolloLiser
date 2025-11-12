import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../dto/pagination.dto';

export class QueryRemitosEstadoDto extends PaginationDto {
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  proveedor_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numero_remito?: string; // like

  @IsOptional()
  @IsIn(['SIN_VENDER', 'PARCIAL', 'VENDIDO'])
  estado?: 'SIN_VENDER' | 'PARCIAL' | 'VENDIDO';
}

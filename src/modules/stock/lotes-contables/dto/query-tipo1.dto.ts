import {
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumberString,
} from 'class-validator';

export class QueryTipo1Dto {
  @IsOptional()
  @IsNumberString()
  producto_id?: number;

  @IsOptional()
  @IsNumberString()
  tipo_producto_id?: number;

  @IsOptional()
  empresa_factura?: string;

  @IsOptional()
  estado?: string;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;
}

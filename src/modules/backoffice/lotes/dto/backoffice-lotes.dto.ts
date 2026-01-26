import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class QueryBackofficeLotesDto {
  @IsOptional()
  @IsUUID()
  lote_id?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CreateBackofficeLoteDto {
  @IsUUID()
  lote_id: string;

  // Backoffice: cantidad = cantidad_tipo1
  @IsNumber()
  @Min(0)
  cantidad: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_vendida?: number;

  @IsString()
  empresa_factura: string;
}

export class UpdateBackofficeLoteDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_vendida?: number;

  @IsOptional()
  @IsString()
  empresa_factura?: string;

  @IsOptional()
  @IsString()
  estado?: string; // si querés permitir override manual, si no lo sacamos
}

// Productos con pendiente (equiv a /tipo1)
export class QueryBackofficeProductosPendientesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  producto_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  tipo_producto_id?: number;

  @IsOptional()
  @IsString()
  empresa_factura?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  desde?: string; // date string

  @IsOptional()
  @IsString()
  hasta?: string; // date string
}

export class FacturarBackofficeDto {
  @IsInt()
  @Min(1)
  producto_id: number;

  @IsNumber()
  @IsPositive()
  cantidad: number;
}

export class SeleccionarBackofficeDto {
  @IsInt({ each: true })
  @Min(1, { each: true })
  producto_ids: number[];

  @IsNumber()
  @IsPositive()
  monto_objetivo: number;

  @IsOptional()
  @IsString()
  empresa_factura?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;
}

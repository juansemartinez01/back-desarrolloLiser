// src/caja/dto/movimiento.dto.ts
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { MetodoPago } from '../enums/metodo-pago.enum';
import { TipoMovimiento } from '../enums/tipo-movimiento.enum';
import { TarjetaTipo } from '../enums/tarjeta-tipo.enum';
import { Type } from 'class-transformer';
import { PagoDetalleDto } from './pago-detalle.dto';

export class MovimientoDto {
  @IsNumber()
  monto: number;

  // ✅ Nuevo: split payments
  @ValidateIf((o) => o.pagos != null)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PagoDetalleDto)
  pagos?: PagoDetalleDto[];

  // ✅ Compatibilidad: modo viejo (si NO mandan pagos[])
  @ValidateIf((o) => !o.pagos || o.pagos.length === 0)
  @IsEnum(MetodoPago)
  metodoPago?: MetodoPago;

  

  @IsEnum(TipoMovimiento)
  tipo: TipoMovimiento;

  @IsString()
  usuario: string;

  @IsOptional()
  @IsEnum(TarjetaTipo)
  tarjetaTipo?: TarjetaTipo;

  @IsOptional()
  @IsString()
  tarjetaUltimos4?: string;

  @IsOptional()
  @IsString()
  codigoAutorizacion?: string;

  @IsOptional()
  @IsString()
  nombreEntidad?: string;

  @IsOptional()
  @IsString()
  referencia?: string;
}

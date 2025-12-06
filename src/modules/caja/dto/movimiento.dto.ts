// src/caja/dto/movimiento.dto.ts
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { MetodoPago } from '../enums/metodo-pago.enum';
import { TipoMovimiento } from '../enums/tipo-movimiento.enum';
import { TarjetaTipo } from '../enums/tarjeta-tipo.enum';

export class MovimientoDto {
  @IsNumber()
  monto: number;

  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

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

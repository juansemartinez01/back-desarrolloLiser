import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { MetodoPago } from '../enums/metodo-pago.enum';
import { TarjetaTipo } from '../enums/tarjeta-tipo.enum';

export class PagoDetalleDto {
  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsEnum(TarjetaTipo)
  tarjetaTipo?: TarjetaTipo;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  @Matches(/^\d{4}$/, { message: 'tarjetaUltimos4 debe ser 4 dígitos' })
  tarjetaUltimos4?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigoAutorizacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombreEntidad?: string;
}

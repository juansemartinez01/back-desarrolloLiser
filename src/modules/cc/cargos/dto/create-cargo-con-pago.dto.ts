// src/modules/cc/cargos/dto/create-cargo-con-pago.dto.ts
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateCargoDto } from './create-cargo.dto';

export class CreateCargoConPagoDto extends CreateCargoDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  metodo_pago?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  datos_pago?: string;
}

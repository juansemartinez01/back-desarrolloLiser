import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmarLiquidacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;
}

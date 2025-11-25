import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateEmisorDto {
  @IsOptional()
  @IsInt()
  @Min(20000000000)
  cuit_computador?: number;

  @IsOptional()
  @IsInt()
  @Min(20000000000)
  cuit_representado?: number;

  @IsOptional()
  @IsString()
  cert_pem?: string;

  @IsOptional()
  @IsString()
  key_pem?: string;

  @IsOptional()
  @IsBoolean()
  test?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre_publico?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

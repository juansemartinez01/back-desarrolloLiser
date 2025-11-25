import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEmisorDto {
  @IsInt()
  @Min(20000000000)
  cuit_computador: number;

  @IsInt()
  @Min(20000000000)
  cuit_representado: number;

  @IsString()
  @IsNotEmpty()
  cert_pem: string; // contenido PEM

  @IsString()
  @IsNotEmpty()
  key_pem: string; // contenido PEM

  @IsBoolean()
  test: boolean = true;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre_publico?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

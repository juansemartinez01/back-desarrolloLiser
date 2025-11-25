import { IsBoolean, IsOptional } from 'class-validator';

export class RegistrarEmisorDto {
  // Permite sobrescribir el flag test al registrar
  @IsOptional()
  @IsBoolean()
  test?: boolean;
}

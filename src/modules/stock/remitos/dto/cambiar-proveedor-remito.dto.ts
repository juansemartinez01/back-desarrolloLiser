// dto/cambiar-proveedor-remito.dto.ts
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CambiarProveedorRemitoDto {
  @IsInt()
  @Min(1)
  proveedor_id: number;

  // opcional: si no viene, lo leemos desde fin_proveedores.nombre
  @IsOptional()
  @IsString()
  @MaxLength(200)
  proveedor_nombre?: string;
}

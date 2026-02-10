import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProveedorDto } from './create-proveedor.dto';

export class ImportProveedoresDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProveedorDto)
  proveedores: CreateProveedorDto[];
}

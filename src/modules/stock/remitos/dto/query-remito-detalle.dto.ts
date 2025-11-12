import { IsUUID } from 'class-validator';

export class QueryRemitoDetalleDto {
  @IsUUID()
  id: string;
}

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PaginationDto } from '../../dto/pagination.dto';

export class QueryStockActualDto extends PaginationDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  producto_id?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  almacen_id?: number;
}

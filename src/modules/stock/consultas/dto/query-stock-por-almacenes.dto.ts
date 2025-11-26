import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryStockPorAlmacenesDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((x) => Number(x.trim()))
      : value,
  )
  almacenes?: number[]; // lista opcional de IDs de almacén
}

import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryStockPorAlmacenesDto {
  @IsOptional()
  @IsString()
  almacenes?: string;
}

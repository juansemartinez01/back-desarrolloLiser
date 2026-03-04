import { IsArray, IsBooleanString, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryStockPorAlmacenesDto {
  @IsOptional()
  @IsString()
  almacenes?: string;


  // ✅ nuevo
  @IsOptional()
  @IsBooleanString()
  solo_con_stock?: string; // 'true' | 'false'

}

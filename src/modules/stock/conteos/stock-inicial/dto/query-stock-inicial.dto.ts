import { IsDateString, IsOptional } from 'class-validator';

export class QueryStockInicialDto {
  @IsOptional()
  @IsDateString()
  dia?: string; // ISO. Si no viene: se toma hoy (Argentina)
}

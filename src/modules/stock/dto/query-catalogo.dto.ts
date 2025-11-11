// dto/query-catalogo.dto.ts
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryCatalogoDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

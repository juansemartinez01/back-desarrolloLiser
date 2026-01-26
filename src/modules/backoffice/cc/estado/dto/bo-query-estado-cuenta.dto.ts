// src/modules/backoffice/cc/estado/dto/bo-query-estado-cuenta.dto.ts
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export type MovimientoTipo = 'CARGO' | 'PAGO' | 'NC' | 'ND';

function toBool(v: any) {
  if (v === true || v === false) return v;
  if (typeof v === 'string')
    return ['true', '1', 'yes', 'si'].includes(v.toLowerCase());
  return undefined;
}

function parseTipos(v: any): MovimientoTipo[] | undefined {
  if (!v) return undefined;
  const arr = Array.isArray(v) ? v : String(v).split(',');
  const norm = arr.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
  const allowed = new Set(['CARGO', 'PAGO', 'NC', 'ND']);
  const out = norm.filter((x) => allowed.has(x)) as MovimientoTipo[];
  return out.length ? out : undefined;
}

export class BoQueryEstadoCuentaDto {
  @IsUUID()
  cliente_id: string;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  include_movimientos?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseTipos(value))
  tipos?: MovimientoTipo[];

  @IsOptional()
  @IsString()
  q?: string;
}

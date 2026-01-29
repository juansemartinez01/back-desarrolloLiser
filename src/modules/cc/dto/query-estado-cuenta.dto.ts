import { Type, Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  IsBoolean,
  IsString,
} from 'class-validator';
import { PagoCuenta } from '../enums/pago-cuenta.enum';

export type MovimientoTipo = 'CARGO' | 'PAGO' | 'NC' | 'ND';

function toBool(v: any): boolean | undefined {
  if (v === true || v === false) return v;
  if (v === null || v === undefined) return undefined;

  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'si'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;

  return undefined;
}


function parseTipos(v: any): MovimientoTipo[] | undefined {
  if (!v) return undefined;
  // acepta: tipos=CARGO,PAGO o tipos=CARGO&tipos=PAGO
  const arr = Array.isArray(v) ? v : String(v).split(',');
  const norm = arr.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
  const allowed = new Set(['CARGO', 'PAGO', 'NC', 'ND']);
  const out = norm.filter((x) => allowed.has(x)) as MovimientoTipo[];
  return out.length ? out : undefined;
}

export class QueryEstadoCuentaDto {
  @IsUUID()
  cliente_id: string;

  @IsOptional()
  @IsDateString()
  desde?: string; // inclusivo

  @IsOptional()
  @IsDateString()
  hasta?: string; // exclusivo

  // ✅ ahora soporta AMBAS
  @IsOptional()
  @IsIn(['CUENTA1', 'CUENTA2', 'AMBAS'])
  cuenta?: 'CUENTA1' | 'CUENTA2' | 'AMBAS'; // CUENTA1 | CUENTA2 (en tu service la tratás como requerida)

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

  // ✅ nuevo: traer o no el listado
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  include_movimientos?: boolean; // default true

  // ✅ nuevo: filtrar tipos (afecta SOLO movimientos)
  @IsOptional()
  @Transform(({ value }) => parseTipos(value))
  tipos?: MovimientoTipo[];

  // ✅ nuevo: búsqueda simple en ref/observacion (SOLO movimientos)
  @IsOptional()
  @IsString()
  q?: string;
}

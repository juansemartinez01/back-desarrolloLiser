import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import { Proveedor } from './entities/proveedor.entity';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { QueryProveedoresDto } from './dto/query-proveedores.dto';

function parseBool(v?: string): boolean | undefined {
  if (v === undefined) return undefined;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'si'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return undefined;
}

// -------------------------
// Normalización PRO
// -------------------------

function cleanStr(v: any): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s) return null;

  // placeholders típicos
  if (s === '-' || s === '- -' || s === '-        -') return null;
  if (/^\|(\s*\|\s*)+\|?$/.test(s)) return null; // " | | " etc.
  if (/^0(\.0)?$/.test(s)) return null;

  return s;
}

function getRaw(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

function normalizeCuit(v: any): string | null {
  const s = cleanStr(v);
  if (!s) return null;

  // algunas fuentes traen sin guiones -> opcional: intentar formatear
  const onlyDigits = s.replace(/\D/g, '');
  if (onlyDigits.length === 11) {
    const formatted = `${onlyDigits.slice(0, 2)}-${onlyDigits.slice(
      2,
      10,
    )}-${onlyDigits.slice(10)}`;
    return formatted;
  }

  // formato oficial con guiones
  if (/^\d{2}-\d{8}-\d{1}$/.test(s)) return s;

  return null;
}

function normalizeEmail(v: any): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  if (!s.includes('@')) return null;
  return s.toLowerCase();
}

function normalizeTelefonos(v: any): string | null {
  const s = cleanStr(v);
  if (!s) return null;

  // si es un template vacío con pipes o muchos espacios, ya lo corta cleanStr
  // pero agrego una regla extra por si viene "                |                 |                "
  if (s.includes('|') && s.replace(/[|\s]/g, '').length === 0) return null;

  return s;
}

function shouldBeInactive(texts: Array<string | null | undefined>): boolean {
  const t = texts.filter(Boolean).join(' ').toUpperCase();

  // reglas simples para “no-proveedores”
  const badTokens = [
    'PRESTAMO',
    'RETIRO',
    'CHEQUE',
    'CHEQUES',
    'NO USAR',
    'EMPLEADO',
    'EMPLEADA',
    'SUELDO',
    'BANCO',
    'TRANSFER',
    'USD',
  ];

  return badTokens.some((x) => t.includes(x));
}

/**
 * Acepta:
 * - formato DTO (camelCase)
 * - o formato “crudo” excel JSON: CUIT, NOMBRE, COND. IVA, etc.
 */
function normalizeInputRow(r: any): CreateProveedorDto | null {
  const nombreRaw =
    cleanStr(getRaw(r, 'nombre', 'NOMBRE')) ??
    (cleanStr(getRaw(r, 'CUIT')) && cleanStr(getRaw(r, 'CUIT')) !== '-        -'
      ? cleanStr(getRaw(r, 'CUIT'))
      : null);

  if (!nombreRaw) return null;

  // Si viene "* No Informado", usamos CUIT (si sirve) o descartamos
  let nombre = nombreRaw;
  if (nombre === '* No Informado') {
    const alt = cleanStr(getRaw(r, 'CUIT', 'cuit'));
    if (!alt) return null;
    nombre = alt;
  }

  const cuitCandidate = getRaw(r, 'cuit', 'CUIT');
  const cuit = normalizeCuit(cuitCandidate);

  const domicilio = cleanStr(getRaw(r, 'domicilio', 'DOMICILIO'));
  const localidad = cleanStr(getRaw(r, 'localidad', 'LOCALIDAD'));
  const cond_iva = cleanStr(getRaw(r, 'cond_iva', 'COND. IVA', 'COND_IVA'));
  const tipo = cleanStr(getRaw(r, 'tipo', 'TIPO'));
  const telefonos = normalizeTelefonos(getRaw(r, 'telefonos', 'TELEFONOS'));
  const email = normalizeEmail(getRaw(r, 'email', 'EMAIL'));
  const categoria = cleanStr(getRaw(r, 'categoria', 'CATEGORIA'));
  const estado = cleanStr(getRaw(r, 'estado', 'ESTADO'));
  const external_ref =
    cleanStr(getRaw(r, 'external_ref', 'EXTERNAL_REF')) ?? null;

  // activo:
  // - si lo mandan explícito lo respeto, pero si detecto “no proveedor”, lo fuerzo a false
  const activoInput = (r as any)?.activo;
  const activoBase = typeof activoInput === 'boolean' ? activoInput : true;

  const inactiveByRule = shouldBeInactive([
    cuitCandidate,
    nombre,
    estado,
    categoria,
  ]);
  const activo = inactiveByRule ? false : activoBase;

  // id opcional
  const idRaw = getRaw(r, 'id', 'ID');
  const id =
    typeof idRaw === 'number'
      ? idRaw
      : idRaw != null && String(idRaw).trim() !== ''
        ? Number(idRaw)
        : undefined;

  const dto: CreateProveedorDto = {
    ...(Number.isFinite(id) ? { id } : {}),
    nombre,
    cuit: cuit ?? undefined,
    activo,
    external_ref: external_ref ?? undefined,
    domicilio: domicilio ?? undefined,
    localidad: localidad ?? undefined,
    cond_iva: cond_iva ?? undefined,
    tipo: tipo ?? undefined,
    telefonos: telefonos ?? undefined,
    email: email ?? undefined,
    categoria: categoria ?? undefined,
    estado: estado ?? undefined,
  };

  return dto;
}

@Injectable()
export class ProveedoresService {
  constructor(
    @InjectRepository(Proveedor) private readonly repo: Repository<Proveedor>,
    private readonly ds: DataSource,
  ) {}

  async findAll(q: QueryProveedoresDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const activo = parseBool(q.activo);

    const where: any[] = [];
    const base: any = {};
    if (activo !== undefined) base.activo = activo;

    if (q.q?.trim()) {
      const term = q.q.trim();
      where.push({ ...base, nombre: ILike(`%${term}%`) });
      where.push({ ...base, cuit: ILike(`%${term}%`) });
    } else {
      where.push(base);
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { nombre: 'ASC' },
      take: limit,
      skip,
    });

    return {
      page,
      limit,
      total,
      items,
    };
  }

  async findOne(id: number) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Proveedor no encontrado');
    return p;
  }

  async create(dto: CreateProveedorDto) {
    const entity = this.repo.create({
      ...dto,
      activo: dto.activo ?? true,
      cuit: dto.cuit ?? null,
      external_ref: dto.external_ref ?? null,
    });

    try {
      return await this.repo.save(entity);
    } catch (e: any) {
      throw new BadRequestException(e?.detail ?? 'Error creando proveedor');
    }
  }

  async update(id: number, dto: UpdateProveedorDto) {
    const p = await this.findOne(id);
    Object.assign(p, dto);
    try {
      return await this.repo.save(p);
    } catch (e: any) {
      throw new BadRequestException(
        e?.detail ?? 'Error actualizando proveedor',
      );
    }
  }

  async setActivo(id: number, activo: boolean) {
    const p = await this.findOne(id);
    p.activo = activo;
    return this.repo.save(p);
  }

  /**
   * Import masivo:
   * - Normaliza dentro del backend (acepta JSON crudo tipo Excel)
   * - Si trae id => upsert por id
   * - Si NO trae id pero trae cuit válido => upsert por cuit
   * - Si no trae ni id ni cuit => insert (puede duplicar por nombre)
   */
  async importMany(rows: any[]) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { inserted: 0, updated: 0, total: 0, skipped: 0 };
    }

    const normalized = rows
      .map((r) => normalizeInputRow(r))
      .filter((x): x is CreateProveedorDto => !!x);

    const skipped = rows.length - normalized.length;

    if (normalized.length === 0) {
      return { inserted: 0, updated: 0, total: 0, skipped };
    }

    let inserted = 0;
    let updated = 0;

    await this.ds.transaction(async (trx) => {
      const repo = trx.getRepository(Proveedor);

      // 1) upsert por ID
      const withId = normalized.filter(
        (r) => typeof r.id === 'number' && Number.isFinite(r.id),
      );
      if (withId.length) {
        const res = await repo
          .createQueryBuilder()
          .insert()
          .into(Proveedor)
          .values(withId as any)
          .orUpdate(
            [
              'nombre',
              'cuit',
              'activo',
              'external_ref',
              'domicilio',
              'localidad',
              'cond_iva',
              'tipo',
              'telefonos',
              'email',
              'categoria',
              'estado',
              'updated_at',
            ],
            ['id'],
          )
          .execute();

        inserted += res.identifiers?.length ?? 0;
      }

      // 2) upsert por CUIT válido (sin id y con cuit)
      const withCuit = normalized.filter((r) => !r.id && r.cuit);
      for (const r of withCuit) {
        const existing = await repo.findOne({ where: { cuit: r.cuit as any } });
        if (!existing) {
          await repo.save(repo.create(r as any));
          inserted++;
        } else {
          Object.assign(existing, r);
          await repo.save(existing);
          updated++;
        }
      }

      // 3) inserts sin id y sin cuit
      const withoutKey = normalized.filter((r) => !r.id && !r.cuit);
      if (withoutKey.length) {
        const entities = repo.create(withoutKey as any);
        await repo.save(entities);
        inserted += withoutKey.length;
      }
    });

    return { inserted, updated, total: normalized.length, skipped };
  }
}

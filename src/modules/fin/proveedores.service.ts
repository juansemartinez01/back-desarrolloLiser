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
   * - Si trae id => upsert por id
   * - Si NO trae id pero trae cuit => upsert por cuit (requiere índice único WHERE cuit IS NOT NULL)
   * - Si no trae ni id ni cuit => insert (puede duplicar por nombre)
   */
  async importMany(rows: CreateProveedorDto[]) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { inserted: 0, updated: 0, total: 0 };
    }

    // normalización mínima
    const normalized = rows
      .filter((r) => r?.nombre && String(r.nombre).trim().length > 0)
      .map((r) => ({
        ...r,
        nombre: String(r.nombre).trim(),
        cuit: r.cuit ? String(r.cuit).trim() : null,
        activo: r.activo ?? true,
        external_ref: r.external_ref ?? null,
      }));

    let inserted = 0;
    let updated = 0;

    await this.ds.transaction(async (trx) => {
      const repo = trx.getRepository(Proveedor);

      // 1) upsert por ID (los que traen id)
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

        // TypeORM no siempre desglosa insert vs update en todos los drivers;
        // devolvemos aproximado por diferencia (mejor que nada).
        inserted += res.identifiers?.length ?? 0;
      }

      // 2) upsert por CUIT (sin id y con cuit)
      const withCuit = normalized.filter((r) => !r.id && r.cuit);
      for (const r of withCuit) {
        // upsert 1 a 1 por CUIT (seguro y claro)
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

      // 3) inserts (sin id y sin cuit)
      const withoutKey = normalized.filter((r) => !r.id && !r.cuit);
      if (withoutKey.length) {
        const entities = repo.create(withoutKey as any);
        await repo.save(entities);
        inserted += withoutKey.length;
      }
    });

    return { inserted, updated, total: normalized.length };
  }
}

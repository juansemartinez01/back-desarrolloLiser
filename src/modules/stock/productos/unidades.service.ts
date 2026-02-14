// src/modules/stock/productos/unidades.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Unidad } from './entities/unidad.entity';
import {
  CreateUnidadDto,
  UpdateUnidadDto,
  QueryUnidadDto,
} from './dto/unidad.dto';
import { OutboxEvent } from '../outbox/outbox-event.entity';

@Injectable()
export class UnidadesService {
  constructor(private readonly ds: DataSource) {}

  async listar(q: QueryUnidadDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.ds.getRepository(Unidad).createQueryBuilder('u');

    if (q.search) {
      qb.andWhere(
        '(u.codigo ILIKE :s OR u.nombre ILIKE :s OR u.abreviatura ILIKE :s)',
        { s: `%${q.search}%` },
      );
    }
    if (q.activo !== undefined) {
      qb.andWhere('u.activo = :a', { a: q.activo });
    }

    qb.orderBy('u.codigo', 'ASC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async obtener(id: number) {
    const u = await this.ds.getRepository(Unidad).findOne({ where: { id } });
    if (!u) throw new NotFoundException('Unidad no encontrada');
    return u;
  }

  async crear(dto: CreateUnidadDto) {
    const repo = this.ds.getRepository(Unidad);

    const existe = await repo.findOne({ where: { codigo: dto.codigo } });
    if (existe)
      throw new BadRequestException('Ya existe una unidad con ese código');

    const u = repo.create({
      codigo: dto.codigo,
      nombre: dto.nombre ?? null,
      abreviatura: dto.abreviatura ?? null,
      activo: dto.activo ?? true,
    });

    // ... dentro de crear:
    const creada = await repo.save(u);

    await this.ds.getRepository(OutboxEvent).save({
      aggregate_type: 'Unidad',
      aggregate_id: String(creada.id),
      event_type: 'UNIDAD_UPSERT_VENTAS',
      payload: {
        id: creada.id,
        nombre: creada.nombre ?? creada.codigo,
        abreviatura: creada.abreviatura ?? null,
        activo: creada.activo,
      },
    });

    return creada;
  }

  async actualizar(id: number, dto: UpdateUnidadDto) {
    const repo = this.ds.getRepository(Unidad);
    const u = await repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Unidad no encontrada');

    const before = {
      codigo: u.codigo,
      nombre: u.nombre,
      abreviatura: u.abreviatura,
      activo: u.activo,
    };

    if (dto.codigo && dto.codigo !== u.codigo) {
      const existe = await repo.findOne({ where: { codigo: dto.codigo } });
      if (existe)
        throw new BadRequestException('Ya existe una unidad con ese código');
      u.codigo = dto.codigo;
    }

    if (dto.nombre !== undefined) u.nombre = dto.nombre ?? null;
    if (dto.abreviatura !== undefined) u.abreviatura = dto.abreviatura ?? null;
    if (dto.activo !== undefined) u.activo = dto.activo;

    u.updated_at = new Date();
    const updated = await repo.save(u);

    const after = {
      codigo: updated.codigo,
      nombre: updated.nombre,
      abreviatura: updated.abreviatura,
      activo: updated.activo,
    };

    const changed = JSON.stringify(before) !== JSON.stringify(after);

    if (changed) {
      await this.ds.getRepository(OutboxEvent).save({
        aggregate_type: 'Unidad',
        aggregate_id: String(updated.id),
        event_type: 'UNIDAD_UPSERT_VENTAS',
        payload: {
          id: updated.id,
          nombre: updated.nombre ?? updated.codigo,
          abreviatura: updated.abreviatura ?? null,
          activo: updated.activo,
          codigo: updated.codigo,
        },
      });
    }

    return updated;
  }

  async borrar(id: number) {
    const repo = this.ds.getRepository(Unidad);
    const u = await repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Unidad no encontrada');

    u.activo = false;
    u.updated_at = new Date();
    const updated = await repo.save(u);

    await this.ds.getRepository(OutboxEvent).save({
      aggregate_type: 'Unidad',
      aggregate_id: String(updated.id),
      event_type: 'UNIDAD_UPSERT_VENTAS',
      payload: {
        id: updated.id,
        nombre: updated.nombre ?? updated.codigo,
        abreviatura: updated.abreviatura ?? null,
        activo: updated.activo, // false
      },
    });

    return { ok: true };

  }
}

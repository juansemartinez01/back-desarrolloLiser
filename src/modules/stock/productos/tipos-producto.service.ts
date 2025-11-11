// src/modules/stock/productos/tipos-producto.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TipoProducto } from './entities/tipo-producto.entity';
import {
  CreateTipoProductoDto,
  UpdateTipoProductoDto,
  QueryTipoProductoDto,
} from './dto/tipo-producto.dto';

@Injectable()
export class TiposProductoService {
  constructor(private readonly ds: DataSource) {}

  async listar(q: QueryTipoProductoDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.ds.getRepository(TipoProducto).createQueryBuilder('t');

    if (q.search) {
      qb.andWhere('(t.nombre ILIKE :s OR t.descripcion ILIKE :s)', {
        s: `%${q.search}%`,
      });
    }
    if (q.activo !== undefined) {
      qb.andWhere('t.activo = :a', { a: q.activo });
    }

    qb.orderBy('t.nombre', 'ASC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async obtener(id: number) {
    const t = await this.ds
      .getRepository(TipoProducto)
      .findOne({ where: { id } });
    if (!t) throw new NotFoundException('Tipo de producto no encontrado');
    return t;
  }

  async crear(dto: CreateTipoProductoDto) {
    const repo = this.ds.getRepository(TipoProducto);

    const existe = await repo.findOne({ where: { nombre: dto.nombre } });
    if (existe) {
      throw new BadRequestException(
        'Ya existe un tipo de producto con ese nombre',
      );
    }

    const t = repo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      activo: dto.activo ?? true,
    });
    return repo.save(t);
  }

  async actualizar(id: number, dto: UpdateTipoProductoDto) {
    const repo = this.ds.getRepository(TipoProducto);
    const t = await repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Tipo de producto no encontrado');

    if (dto.nombre && dto.nombre !== t.nombre) {
      const existe = await repo.findOne({ where: { nombre: dto.nombre } });
      if (existe) {
        throw new BadRequestException(
          'Ya existe un tipo de producto con ese nombre',
        );
      }
      t.nombre = dto.nombre;
    }

    if (dto.descripcion !== undefined) t.descripcion = dto.descripcion ?? null;
    if (dto.activo !== undefined) t.activo = dto.activo;

    t.updated_at = new Date();
    return repo.save(t);
  }

  async borrar(id: number) {
    const repo = this.ds.getRepository(TipoProducto);
    const t = await repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Tipo de producto no encontrado');

    t.activo = false;
    t.updated_at = new Date();
    await repo.save(t);
    return { ok: true };
  }
}

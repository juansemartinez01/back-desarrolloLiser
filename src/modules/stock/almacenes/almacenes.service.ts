// src/modules/stock/almacenes/almacenes.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Almacen } from './entities/almacen.entity';
import {
  CreateAlmacenDto,
  UpdateAlmacenDto,
  QueryAlmacenDto,
} from './dto/almacen.dto';

@Injectable()
export class AlmacenesService {
  constructor(private readonly ds: DataSource) {}

  async listar(q: QueryAlmacenDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.ds.getRepository(Almacen).createQueryBuilder('a');

    if (q.search) {
      qb.andWhere(
        `
        (a.nombre ILIKE :s OR a.ciudad ILIKE :s OR a.codigo_interno ILIKE :s)
      `,
        { s: `%${q.search}%` },
      );
    }

    if (q.activo !== undefined) qb.andWhere('a.activo = :a', { a: q.activo });

    qb.orderBy('a.nombre', 'ASC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async obtener(id: string) {
    const a = await this.ds.getRepository(Almacen).findOne({ where: { id } });
    if (!a) throw new NotFoundException('Almacén no encontrado');
    return a;
  }

  async crear(dto: CreateAlmacenDto) {
    const repo = this.ds.getRepository(Almacen);

    if (dto.codigo_interno) {
      const dup = await repo.findOne({
        where: { codigo_interno: dto.codigo_interno },
      });
      if (dup)
        throw new BadRequestException(
          'Ya existe un almacén con ese código interno',
        );
    }

    const a = repo.create({
      ...dto,
      activo: dto.activo ?? true,
    });
    return repo.save(a);
  }

  async actualizar(id: string, dto: UpdateAlmacenDto) {
    const repo = this.ds.getRepository(Almacen);
    const a = await repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Almacén no encontrado');

    if (dto.codigo_interno && dto.codigo_interno !== a.codigo_interno) {
      const dup = await repo.findOne({
        where: { codigo_interno: dto.codigo_interno },
      });
      if (dup)
        throw new BadRequestException(
          'Ya existe un almacén con ese código interno',
        );
    }

    Object.assign(a, dto);
    a.updated_at = new Date();
    return repo.save(a);
  }

  
}

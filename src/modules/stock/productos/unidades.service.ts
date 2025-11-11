// unidades.service.ts
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

@Injectable()
export class UnidadesService {
  constructor(private readonly ds: DataSource) {}

  async listar(q: QueryUnidadDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.ds.getRepository(Unidad).createQueryBuilder('u');

    if (q.search) {
      qb.andWhere('(u.codigo ILIKE :s OR u.descripcion ILIKE :s)', {
        s: `%${q.search}%`,
      });
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
    if (existe) {
      throw new BadRequestException('Ya existe una unidad con ese código');
    }

    const u = repo.create({
      codigo: dto.codigo,
      descripcion: dto.descripcion ?? null,
      activo: dto.activo ?? true,
    });
    return repo.save(u);
  }

  async actualizar(id: number, dto: UpdateUnidadDto) {
    const repo = this.ds.getRepository(Unidad);
    const u = await repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Unidad no encontrada');

    if (dto.codigo && dto.codigo !== u.codigo) {
      const existe = await repo.findOne({ where: { codigo: dto.codigo } });
      if (existe) {
        throw new BadRequestException('Ya existe una unidad con ese código');
      }
      u.codigo = dto.codigo;
    }

    if (dto.descripcion !== undefined) u.descripcion = dto.descripcion ?? null;
    if (dto.activo !== undefined) u.activo = dto.activo;

    u.updated_at = new Date();
    return repo.save(u);
  }

  async borrar(id: number) {
    const repo = this.ds.getRepository(Unidad);
    const u = await repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Unidad no encontrada');

    // Baja lógica
    u.activo = false;
    u.updated_at = new Date();
    await repo.save(u);
    return { ok: true };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { CcCliente } from './entities/cliente.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';

function norm(v?: string | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(CcCliente)
    private readonly repo: Repository<CcCliente>,
  ) {}

  // LISTAR con búsqueda, filtros y paginación
  async listar(q: QueryClientesDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(500, Math.max(1, Number(q.limit ?? 50)));
    const skip = (page - 1) * limit;

    const where: any[] = [];

    // Búsqueda general
    const s = norm(q.search);
    if (s) {
      where.push(
        { nombre: ILike(`%${s}%`) },
        { nombre_fantasia: ILike(`%${s}%`) },
        { dni_cuit: ILike(`%${s}%`) },
        { externo_codigo: ILike(`%${s}%`) },
        { email: ILike(`%${s}%`) },
        { telefono: ILike(`%${s}%`) },
      );
    }

    // Filtro activo
    const activoFilter =
      q.activo === 'true' ? true : q.activo === 'false' ? false : undefined;

    const [rows, total] = await this.repo.findAndCount({
      where:
        where.length > 0
          ? where.map((cond) =>
              activoFilter === undefined
                ? cond
                : { ...cond, activo: activoFilter },
            )
          : activoFilter === undefined
            ? {}
            : { activo: activoFilter },
      order: {
        [q.orderBy ?? 'nombre']: (q.order ?? 'ASC') as 'ASC' | 'DESC',
        id: 'ASC',
      },
      take: limit,
      skip,
      select: [
        'id',
        'nombre',
        'nombre_fantasia',
        'dni_cuit',
        'externo_codigo',
        'telefono',
        'email',
        'activo',
        'created_at',
        'updated_at',
      ],
    });

    return { data: rows, total, page, limit };
  }

  // OBTENER por id
  async obtener(id: string) {
    const cli = await this.repo.findOne({
      where: { id },
      select: [
        'id',
        'nombre',
        'nombre_fantasia',
        'dni_cuit',
        'externo_codigo',
        'telefono',
        'email',
        'activo',
        'created_at',
        'updated_at',
      ],
    });
    if (!cli) throw new NotFoundException('Cliente no encontrado');
    return cli;
  }

  // CREAR
  async crear(dto: CreateClienteDto) {
    const dni = norm(dto.dni_cuit);
    const ext = norm(dto.externo_codigo);

    // Unicidades manuales (porque son únicas pero NULL permitido)
    if (dni) {
      const exist = await this.repo.findOne({ where: { dni_cuit: dni } });
      if (exist) throw new BadRequestException('dni_cuit ya existe');
    }
    if (ext) {
      const exist = await this.repo.findOne({ where: { externo_codigo: ext } });
      if (exist) throw new BadRequestException('externo_codigo ya existe');
    }

    const entity = this.repo.create({
      nombre: dto.nombre.trim(),
      nombre_fantasia: norm(dto.nombre_fantasia) ?? null,
      dni_cuit: dni ?? null,
      externo_codigo: ext ?? null,
      telefono: norm(dto.telefono) ?? null,
      email: norm(dto.email) ?? null,
      activo: dto.activo ?? true,
    });
    const saved = await this.repo.save(entity);
    return this.obtener(saved.id);
  }

  // ACTUALIZAR
  async actualizar(id: string, dto: UpdateClienteDto) {
    const cli = await this.repo.findOne({ where: { id } });
    if (!cli) throw new NotFoundException('Cliente no encontrado');

    const dni = norm(dto.dni_cuit);
    const ext = norm(dto.externo_codigo);

    if (dni) {
      const exist = await this.repo.findOne({
        where: { dni_cuit: dni, id: Not(id) },
      });
      if (exist)
        throw new BadRequestException('dni_cuit ya existe en otro cliente');
    }
    if (ext) {
      const exist = await this.repo.findOne({
        where: { externo_codigo: ext, id: Not(id) },
      });
      if (exist)
        throw new BadRequestException(
          'externo_codigo ya existe en otro cliente',
        );
    }

    this.repo.merge(cli, {
      nombre: dto.nombre?.trim() ?? cli.nombre,
      nombre_fantasia:
        dto.nombre_fantasia === undefined
          ? cli.nombre_fantasia
          : (norm(dto.nombre_fantasia) ?? null),
      dni_cuit: dto.dni_cuit === undefined ? cli.dni_cuit : (dni ?? null),
      externo_codigo:
        dto.externo_codigo === undefined ? cli.externo_codigo : (ext ?? null),
      telefono:
        dto.telefono === undefined
          ? cli.telefono
          : (norm(dto.telefono) ?? null),
      email: dto.email === undefined ? cli.email : (norm(dto.email) ?? null),
      activo: dto.activo === undefined ? cli.activo : dto.activo,
    });

    await this.repo.save(cli);
    return this.obtener(id);
  }

  // BAJA LÓGICA: desactivar/activar
  async desactivar(id: string) {
    const ok = await this.repo.update({ id }, { activo: false });
    if (!ok.affected) throw new NotFoundException('Cliente no encontrado');
    return this.obtener(id);
  }

  async activar(id: string) {
    const ok = await this.repo.update({ id }, { activo: true });
    if (!ok.affected) throw new NotFoundException('Cliente no encontrado');
    return this.obtener(id);
  }

  // ELIMINAR (hard delete)
  async eliminar(id: string) {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw new NotFoundException('Cliente no encontrado');
    return { ok: true, id };
  }
}

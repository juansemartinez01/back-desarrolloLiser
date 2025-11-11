// src/modules/stock/productos/productos.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Producto } from './entities/producto.entity';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { QueryProductosDto } from './dto/query-productos.dto';

@Injectable()
export class ProductosService {
  constructor(private readonly ds: DataSource) {}

  private toDecimal4(n: number | string | undefined): string {
    const v = n == null ? 0 : Number(n);
    return v.toFixed(4);
  }

  async create(dto: CreateProductoDto) {
    const repo = this.ds.getRepository(Producto);

    const prod = repo.create({
      nombre: dto.nombre,
      precio_base: this.toDecimal4(dto.precio_base),
      unidad_id: dto.unidad_id,
      tipo_producto_id: dto.tipo_producto_id,
      descripcion: dto.descripcion ?? null,
      vacio: dto.vacio ?? false,
      oferta: dto.oferta ?? false,
      precio_oferta: this.toDecimal4(dto.precio_oferta),
      activo: dto.activo ?? true,
      imagen: dto.imagen ?? null,
      precio_vacio: this.toDecimal4(dto.precio_vacio),
      id_interno: dto.id_interno ?? null,
      empresa: dto.empresa ?? null,
      codigo_comercial: dto.codigo_comercial ?? null,
    });

    try {
      return await repo.save(prod);
    } catch (e: any) {
      throw new BadRequestException(
        e?.detail || e?.message || 'Error creando producto',
      );
    }
  }

  async findAll(q: QueryProductosDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const repo = this.ds.getRepository(Producto);
    const qb = repo.createQueryBuilder('p');

    if (q.search) {
      qb.andWhere(
        `(LOWER(p.nombre) LIKE LOWER(:s) OR LOWER(p.codigo_comercial) LIKE LOWER(:s))`,
        { s: `%${q.search}%` },
      );
    }

    if (q.soloActivos === 'true') {
      qb.andWhere('p.activo = true');
    }

    qb.orderBy('p.nombre', 'ASC').take(limit).skip(skip);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: number) {
    const repo = this.ds.getRepository(Producto);
    const prod = await repo.findOne({ where: { id } });
    if (!prod) throw new NotFoundException('Producto no encontrado');
    return prod;
  }

  async update(id: number, dto: UpdateProductoDto) {
    const repo = this.ds.getRepository(Producto);
    const prod = await repo.findOne({ where: { id } });
    if (!prod) throw new NotFoundException('Producto no encontrado');

    if (dto.nombre !== undefined) prod.nombre = dto.nombre;
    if (dto.precio_base !== undefined)
      prod.precio_base = this.toDecimal4(dto.precio_base);
    if (dto.unidad_id !== undefined) prod.unidad_id = dto.unidad_id;
    if (dto.tipo_producto_id !== undefined)
      prod.tipo_producto_id = dto.tipo_producto_id;
    if (dto.descripcion !== undefined) prod.descripcion = dto.descripcion;
    if (dto.vacio !== undefined) prod.vacio = dto.vacio;
    if (dto.oferta !== undefined) prod.oferta = dto.oferta;
    if (dto.precio_oferta !== undefined)
      prod.precio_oferta = this.toDecimal4(dto.precio_oferta);
    if (dto.activo !== undefined) prod.activo = dto.activo;
    if (dto.imagen !== undefined) prod.imagen = dto.imagen;
    if (dto.precio_vacio !== undefined)
      prod.precio_vacio = this.toDecimal4(dto.precio_vacio);
    if (dto.id_interno !== undefined) prod.id_interno = dto.id_interno;
    if (dto.empresa !== undefined) prod.empresa = dto.empresa;
    if (dto.codigo_comercial !== undefined)
      prod.codigo_comercial = dto.codigo_comercial;

    prod.updated_at = new Date();

    try {
      return await repo.save(prod);
    } catch (e: any) {
      throw new BadRequestException(
        e?.detail || e?.message || 'Error actualizando producto',
      );
    }
  }

  // "Baja" lógica: activo = false
  async remove(id: number) {
    const repo = this.ds.getRepository(Producto);
    const prod = await repo.findOne({ where: { id } });
    if (!prod) throw new NotFoundException('Producto no encontrado');

    prod.activo = false;
    prod.updated_at = new Date();
    await repo.save(prod);
    return { ok: true };
  }
}

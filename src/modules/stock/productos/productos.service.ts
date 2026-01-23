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

import { TipoProducto } from './entities/tipo-producto.entity';
import { ProductoPrecioHistorial } from './entities/producto-precio-historial.entity';
import { OutboxEvent } from '../outbox/outbox-event.entity';

// Quita acentos de forma simple
function quitarAcentos(txt: string): string {
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, (m) => (m === 'ñ' ? 'n' : 'N'));
}

function buildTipoPrefix(tipoNombre: string): string {
  const t = quitarAcentos(tipoNombre).toUpperCase().trim();
  if (!t) return 'XXX';
  return t.slice(0, 3); // FRU, VER, CON, etc.
}

function buildNombreCode(nombre: string): string {
  const STOP = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y']);
  const base = quitarAcentos(nombre).toUpperCase();
  const words = base.split(/\s+/).filter(Boolean).filter((w) => !STOP.has(w));

  const parts: string[] = [];
  for (const w of words) {
    if (/^\d+$/.test(w)) {
      // sólo números -> 2 dígitos
      parts.push(w.padStart(2, '0'));
    } else {
      parts.push(w.slice(0, 4)); // primeras 4 letras
    }
  }

  // Máx ~20 chars para que no se vuelva infinito
  return parts.join('').slice(0, 20);
}

function buildProveedorCode(proveedorId?: number | null): string {
  const id = proveedorId ?? 0;
  return 'P' + id.toString().padStart(4, '0'); // P0012
}

function buildEmpresaCode(empresa?: string | null): string {
  if (!empresa) return 'XXXX';
  const e = quitarAcentos(empresa).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!e) return 'XXXX';
  return e.slice(0, 4); // GLAD, SYRU, etc.
}

function buildInternoCode(idInterno?: string | null): string {
  if (!idInterno) return '00000';
  const clean = idInterno.replace(/\D/g, ''); // solo números
  return clean.padStart(5, '0');
}


export function generarCodigoComercial(opts: {
  tipoNombre: string;
  nombreProducto: string;
  proveedorId?: number | null;
  empresa?: string | null;
  idInterno?: string | null;
}): string {
  const tipo = buildTipoPrefix(opts.tipoNombre);
  const nombre = buildNombreCode(opts.nombreProducto);
  const prov = buildProveedorCode(opts.proveedorId);
  const emp = buildEmpresaCode(opts.empresa);
  const interno = buildInternoCode(opts.idInterno);

  return `${tipo}-${nombre}-${prov}-${emp}-${interno}`;
}
@Injectable()
export class ProductosService {
  constructor(private readonly ds: DataSource) {}

  private toDecimal4(n: number | string | undefined): string {
    const v = n == null ? 0 : Number(n);
    return v.toFixed(4);
  }

  async create(dto: CreateProductoDto) {
    const repo = this.ds.getRepository(Producto);
    const tipoRepo = this.ds.getRepository(TipoProducto);

    const tipo = await tipoRepo.findOne({
      where: { id: dto.tipo_producto_id },
    });
    if (!tipo) {
      throw new BadRequestException('Tipo de producto inválido');
    }
    // Generar código comercial
    const codigo = generarCodigoComercial({
      tipoNombre: tipo.nombre,
      nombreProducto: dto.nombre,
      proveedorId: dto.proveedor_id ?? null,
      empresa: dto.empresa ?? null,
      idInterno: dto.id_interno ?? null,
    });

    /** IVA */
    const alicuota = dto.alicuota_iva ?? '21';
    const exento = dto.exento_iva ?? false;

    /** Precios administrativos */
    const precioCompra = this.toDecimal4(dto.precio_compra ?? 0);

    const factorIva = exento ? 1 : 1 + Number(alicuota) / 100;
    const precioSinIva = this.toDecimal4(dto.precio_sin_iva ?? precioCompra);
    const precioConIva = this.toDecimal4(
      dto.precio_con_iva ?? Number(precioCompra) * factorIva,
    );

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
      codigo_comercial: codigo,

      // ADMINISTRATIVOS
      alicuota_iva: alicuota,
      exento_iva: exento,
      precio_compra: precioCompra,
      precio_sin_iva: precioSinIva,
      precio_con_iva: precioConIva,
      selector_fiscal: dto.selector_fiscal ?? 1,
    });

try {
  const nuevoProducto = await repo.save(prod);

  // luego de `const nuevoProducto = await repo.save(prod);`

  await this.ds.getRepository(OutboxEvent).save({
    aggregate_type: 'Producto',
    aggregate_id: String(nuevoProducto.id),
    event_type: 'PRODUCTO_UPSERT_VENTAS',
    payload: {
      codigo_comercial: nuevoProducto.codigo_comercial,
      nombre: nuevoProducto.nombre,
      unidadId: nuevoProducto.unidad_id,
      tipoProductoId: nuevoProducto.tipo_producto_id,
      precio_base: Number(nuevoProducto.precio_base),
      descripcion: nuevoProducto.descripcion ?? null,
      vacio: nuevoProducto.vacio,
      oferta: nuevoProducto.oferta,
      precio_oferta: Number(nuevoProducto.precio_oferta ?? 0),
      activo: nuevoProducto.activo,
      imagen: nuevoProducto.imagen ?? null,
      precioVacio: Number(nuevoProducto.precio_vacio ?? 0),
      empresa: nuevoProducto.empresa ?? null,
      id_interno: nuevoProducto.id_interno ?? '',
    },
  });

  await this.registrarHistorial(
    nuevoProducto,
    'CREACIÓN DE PRODUCTO',
    'system',
  );
  return nuevoProducto;
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

    // formateos
    if (dto.precio_base !== undefined)
      prod.precio_base = this.toDecimal4(dto.precio_base);

    if (dto.precio_oferta !== undefined)
      prod.precio_oferta = this.toDecimal4(dto.precio_oferta);

    if (dto.precio_vacio !== undefined)
      prod.precio_vacio = this.toDecimal4(dto.precio_vacio);

    if (dto.precio_compra !== undefined)
      prod.precio_compra = this.toDecimal4(dto.precio_compra);

    if (dto.precio_sin_iva !== undefined)
      prod.precio_sin_iva = this.toDecimal4(dto.precio_sin_iva);

    if (dto.precio_con_iva !== undefined)
      prod.precio_con_iva = this.toDecimal4(dto.precio_con_iva);

    prod.updated_at = new Date();

    const huboCambioAdmin =
      dto.precio_compra !== undefined ||
      dto.precio_sin_iva !== undefined ||
      dto.precio_con_iva !== undefined ||
      dto.alicuota_iva !== undefined ||
      dto.exento_iva !== undefined ||
      dto.selector_fiscal !== undefined;
    
    
    try {
      
      const actualizado = await repo.save(prod);

      if (huboCambioAdmin) {
        await this.registrarHistorial(
          actualizado,
          'MODIFICACIÓN ADMINISTRATIVA',
          'system',
        );
      }

      return actualizado;
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

  private async registrarHistorial(
    prod: Producto,
    motivo: string,
    usuario?: string,
  ) {
    const historialRepo = this.ds.getRepository(ProductoPrecioHistorial);

    const registro = historialRepo.create({
      codigo_comercial: prod.codigo_comercial!,
      precio_compra: prod.precio_compra,
      precio_sin_iva: prod.precio_sin_iva,
      precio_con_iva: prod.precio_con_iva,
      alicuota_iva: prod.alicuota_iva,
      exento_iva: prod.exento_iva,
      selector_fiscal: prod.selector_fiscal,
      motivo,
      usuario,
    });

    await historialRepo.save(registro);
  }
}

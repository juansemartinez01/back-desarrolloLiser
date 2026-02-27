// src/modules/stock/productos/productos.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Producto } from './entities/producto.entity';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { QueryProductosDto } from './dto/query-productos.dto';

import { TipoProducto } from './entities/tipo-producto.entity';
import { ProductoPrecioHistorial } from './entities/producto-precio-historial.entity';
import { OutboxEvent } from '../outbox/outbox-event.entity';
import axios from 'axios';

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
  private readonly logger = new Logger(ProductosService.name);
  constructor(private readonly ds: DataSource) {}

  private toDecimal4(n: number | string | undefined): string {
    const v = n == null ? 0 : Number(n);
    return v.toFixed(4);
  }

  async create(dto: CreateProductoDto) {
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(Producto);
      const tipoRepo = manager.getRepository(TipoProducto);

      const tipo = await tipoRepo.findOne({
        where: { id: dto.tipo_producto_id },
      });
      if (!tipo) throw new BadRequestException('Tipo de producto inválido');

      // --- tu codigo comercial ---
      const codigo = generarCodigoComercial({
        tipoNombre: tipo.nombre,
        nombreProducto: dto.nombre,
        proveedorId: dto.proveedor_id ?? null,
        empresa: dto.empresa ?? null,
        idInterno: dto.id_interno ?? null,
      });

      // --- IVA y precios (igual que tu método actual) ---
      const alicuota = dto.alicuota_iva ?? '21';
      const exento = dto.exento_iva ?? false;

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

        alicuota_iva: alicuota,
        exento_iva: exento,
        precio_compra: precioCompra,
        precio_sin_iva: precioSinIva,
        precio_con_iva: precioConIva,
        selector_fiscal: dto.selector_fiscal ?? 1,
      });

      const nuevoProducto = await repo.save(prod);

      // ✅ bootstrap de stock en 0 siguiendo crearRemitoDirecto
      await this.bootstrapStockOnCreate(manager, nuevoProducto);

      // // ✅ outbox
      // await manager.getRepository(OutboxEvent).save({
      //   aggregate_type: 'Producto',
      //   aggregate_id: String(nuevoProducto.id),
      //   event_type: 'PRODUCTO_UPSERT_VENTAS',
      //   payload: {
      //     codigo_comercial: nuevoProducto.codigo_comercial,
      //     nombre: nuevoProducto.nombre,
      //     unidadId: nuevoProducto.unidad_id,
      //     tipoProductoId: nuevoProducto.tipo_producto_id,
      //     precio_base: Number(nuevoProducto.precio_base),
      //     descripcion: nuevoProducto.descripcion ?? null,
      //     vacio: nuevoProducto.vacio,
      //     oferta: nuevoProducto.oferta,
      //     precio_oferta: Number(nuevoProducto.precio_oferta ?? 0),
      //     activo: nuevoProducto.activo,
      //     imagen: nuevoProducto.imagen ?? null,
      //     precioVacio: Number(nuevoProducto.precio_vacio ?? 0),
      //     empresa: nuevoProducto.empresa ?? null,
      //     id_interno: nuevoProducto.id_interno ?? '',
      //   },
      // });

      // SYNC Ventas por POST (si falla => rollback)
      const payloadVentas = {
        nombre: nuevoProducto.nombre,
        precio_base: Number(nuevoProducto.precio_base),
        unidadId: nuevoProducto.unidad_id,
        tipoProductoId: nuevoProducto.tipo_producto_id,
        descripcion: nuevoProducto.descripcion ?? undefined,
        vacio: !!nuevoProducto.vacio,
        oferta: !!nuevoProducto.oferta,
        precio_oferta:
          nuevoProducto.precio_oferta != null
            ? Number(nuevoProducto.precio_oferta)
            : undefined,
        activo: !!nuevoProducto.activo,
        imagen: nuevoProducto.imagen ?? undefined,
        id_interno: nuevoProducto.id_interno ?? '', // ⚠️ ver abajo
        precioVacio:
          nuevoProducto.precio_vacio != null
            ? Number(nuevoProducto.precio_vacio)
            : undefined,
        empresa: nuevoProducto.empresa ?? undefined,

        // ✅ NUEVO: asegurás codigo_comercial siempre en ventas
        codigo_comercial: nuevoProducto.codigo_comercial,
      };

      const sync = await this.syncVentasCrearProducto(payloadVentas);
      if (!sync.ok) {
        // IMPORTANTÍSIMO: throw => rollback de toda la tx stock
        throw new BadRequestException(
          `No se pudo crear producto en Ventas. Se revierte la creación. Motivo: ${sync.error ?? sync.reason}`,
        );
      }

      // ✅ historial (ideal con manager)
      await this.registrarHistorialTx(
        manager,
        nuevoProducto,
        'CREACIÓN DE PRODUCTO',
        'system',
      );

      return nuevoProducto;
    });
  }

  async findAll(q: QueryProductosDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const repo = this.ds.getRepository(Producto);
    const qb = repo.createQueryBuilder('p');

    if (q.search) {
      const s = q.search.trim();

      const id = Number(s);
      const isNumericId = s !== '' && Number.isInteger(id) && id > 0;

      qb.andWhere(
        `
    (
      LOWER(p.nombre) LIKE LOWER(:s)
      OR LOWER(p.codigo_comercial) LIKE LOWER(:s)
      ${isNumericId ? 'OR p.id = :id' : ''}
    )
    `,
        {
          s: `%${s}%`,
          ...(isNumericId ? { id } : {}),
        },
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
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(Producto);
      const outboxRepo = manager.getRepository(OutboxEvent);

      const prod = await repo.findOne({ where: { id } });
      if (!prod) throw new NotFoundException('Producto no encontrado');

      // Snapshot para detectar cambios relevantes
      const before = {
        codigo_comercial: prod.codigo_comercial,
        nombre: prod.nombre,
        unidad_id: prod.unidad_id,
        tipo_producto_id: prod.tipo_producto_id,
        precio_base: Number(prod.precio_base ?? 0),
        descripcion: prod.descripcion,
        vacio: prod.vacio,
        oferta: prod.oferta,
        precio_oferta: Number(prod.precio_oferta ?? 0),
        activo: prod.activo,
        imagen: prod.imagen,
        precio_vacio: Number(prod.precio_vacio ?? 0),
        empresa: prod.empresa,
        id_interno: prod.id_interno,
      };

      // -------------------------
      // Aplicar cambios (como ya lo hacías)
      // -------------------------
      if (dto.nombre !== undefined) prod.nombre = dto.nombre;
      if (dto.unidad_id !== undefined) prod.unidad_id = dto.unidad_id;
      if (dto.tipo_producto_id !== undefined)
        prod.tipo_producto_id = dto.tipo_producto_id;
      if (dto.descripcion !== undefined) prod.descripcion = dto.descripcion;
      if (dto.vacio !== undefined) prod.vacio = dto.vacio;
      if (dto.oferta !== undefined) prod.oferta = dto.oferta;
      if (dto.activo !== undefined) prod.activo = dto.activo;
      if (dto.imagen !== undefined) prod.imagen = dto.imagen;
      if (dto.id_interno !== undefined) prod.id_interno = dto.id_interno;
      if (dto.empresa !== undefined) prod.empresa = dto.empresa;

      // formateos (evitá repetir precio_base arriba y abajo)
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

      // OJO: vos tenías huboCambioAdmin considerando campos que NO estás asignando acá:
      // dto.alicuota_iva, dto.exento_iva, dto.selector_fiscal
      // Si esos campos existen en UpdateProductoDto y querés permitir update, agregá asignaciones:
      if ((dto as any).alicuota_iva !== undefined)
        (prod as any).alicuota_iva = (dto as any).alicuota_iva;
      if ((dto as any).exento_iva !== undefined)
        (prod as any).exento_iva = (dto as any).exento_iva;
      if ((dto as any).selector_fiscal !== undefined)
        (prod as any).selector_fiscal = (dto as any).selector_fiscal;

      prod.updated_at = new Date();

      const huboCambioAdmin =
        dto.precio_compra !== undefined ||
        dto.precio_sin_iva !== undefined ||
        dto.precio_con_iva !== undefined ||
        (dto as any).alicuota_iva !== undefined ||
        (dto as any).exento_iva !== undefined ||
        (dto as any).selector_fiscal !== undefined;

      // Guardar producto
      const actualizado = await repo.save(prod);

      // Snapshot after
      const after = {
        codigo_comercial: actualizado.codigo_comercial,
        nombre: actualizado.nombre,
        unidad_id: actualizado.unidad_id,
        tipo_producto_id: actualizado.tipo_producto_id,
        precio_base: Number(actualizado.precio_base ?? 0),
        descripcion: actualizado.descripcion,
        vacio: actualizado.vacio,
        oferta: actualizado.oferta,
        precio_oferta: Number(actualizado.precio_oferta ?? 0),
        activo: actualizado.activo,
        imagen: actualizado.imagen,
        precio_vacio: Number(actualizado.precio_vacio ?? 0),
        empresa: actualizado.empresa,
        id_interno: actualizado.id_interno,
      };

      const changedForVentas = JSON.stringify(before) !== JSON.stringify(after);

      // Si cambió algo que impacta ventas, emitimos evento outbox
      if (changedForVentas) {
        await outboxRepo.save({
          aggregate_type: 'Producto',
          aggregate_id: String(actualizado.id),
          event_type: 'PRODUCTO_UPSERT_VENTAS',
          payload: {
            codigo_comercial: actualizado.codigo_comercial,
            nombre: actualizado.nombre,
            unidadId: actualizado.unidad_id,
            tipoProductoId: actualizado.tipo_producto_id,
            precio_base: Number(actualizado.precio_base),
            descripcion: actualizado.descripcion ?? null,
            vacio: actualizado.vacio,
            oferta: actualizado.oferta,
            precio_oferta: Number(actualizado.precio_oferta ?? 0),
            activo: actualizado.activo,
            imagen: actualizado.imagen ?? null,
            precioVacio: Number(actualizado.precio_vacio ?? 0),
            empresa: actualizado.empresa ?? null,
            id_interno: actualizado.id_interno ?? '',
          },
        });
      }

      // Historial admin (si corresponde)
      if (huboCambioAdmin) {
        // IMPORTANTE: registrarHistorial debe usar el mismo manager si escribe en DB
        // Si registrarHistorial usa this.ds internamente, puede abrir otra tx.
        // Ideal: crear una versión registrarHistorialTx(manager, ...) o pasar el manager.
        await this.registrarHistorial(
          actualizado,
          'MODIFICACIÓN ADMINISTRATIVA',
          'system',
        );
      }

      return actualizado;
    });
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

  private async bootstrapStockOnCreate(manager: EntityManager, prod: Producto) {
    const ahora = new Date();

    let presentacion: string | null = null;
    if (prod.unidad_id) {
      const u = await manager.query(
        `SELECT nombre, codigo FROM public.stk_unidades WHERE id = $1`,
        [prod.unidad_id],
      );
      if (u?.length) presentacion = u[0].nombre ?? u[0].codigo ?? null;
    }

    const emp = (prod.empresa ?? 'GLADIER').toUpperCase();
    const empresaFactura = emp === 'SAYRUS' ? 'SAYRUS' : 'GLADIER';

    const numeroAuto = `INIT-PROD-${prod.id}-${ahora
      .toISOString()
      .replace(/[-:.TZ]/g, '')
      .slice(0, 14)}`;

    const remRows = await manager.query(
      `
    INSERT INTO public.stk_remitos
      (fecha_remito, numero_remito, proveedor_id, proveedor_nombre,
       observaciones, almacen_id, es_ingreso_rapido, pendiente,
       conductor_camion_id, conductor_camion_nombre)
    VALUES ($1,$2,$3,$4,$5,$6,true,false,$7,$8)
    RETURNING id, fecha_remito
    `,
      [ahora, numeroAuto, null, null, 'Init producto (0).', null, null, null],
    );

    const remitoId: string = remRows[0].id;
    const fechaRemito: Date = remRows[0].fecha_remito;

    const itemRows = await manager.query(
      `
    INSERT INTO public.stk_remito_items
      (remito_id, producto_id, unidad, cantidad_total, cantidad_tipo1, cantidad_tipo2,
       empresa_factura, cantidad_remito, nombre_capturado, presentacion_txt, tamano_txt, nota_operario_a)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING id
    `,
      [
        remitoId,
        prod.id,
        null,
        this.toDecimal4(0),
        this.toDecimal4(0),
        this.toDecimal4(0),
        empresaFactura,
        this.toDecimal4(0),
        prod.nombre,
        presentacion,
        '-',
        'Inicialización automática (0).',
      ],
    );

    const remitoItemId: string = itemRows[0].id;

    const loteRows = await manager.query(
      `
    INSERT INTO public.stk_lotes
      (remito_item_id, producto_id, fecha_remito, lote_tipo, cantidad_inicial, cantidad_disponible, bloqueado)
    VALUES ($1,$2,$3,1,$4,$4,false)
    RETURNING id
    `,
      [remitoItemId, prod.id, fechaRemito, this.toDecimal4(0)],
    );

    const loteId: string = loteRows[0].id;

    await manager.query(
      `
    INSERT INTO public.stk_lote_almacen (lote_id, almacen_id, cantidad_asignada, cantidad_disponible)
    SELECT $1::uuid, a.almacen_id, 0, 0
    FROM public.stk_almacenes a
    ON CONFLICT (lote_id, almacen_id) DO NOTHING
    `,
      [loteId],
    );

    await manager.query(
      `
    INSERT INTO public.stk_stock_actual (producto_id, almacen_id, cantidad)
    SELECT $1::int, a.almacen_id, 0
    FROM public.stk_almacenes a
    ON CONFLICT (producto_id, almacen_id) DO NOTHING
    `,
      [prod.id],
    );
  }

  private async registrarHistorialTx(
    manager: EntityManager,
    prod: Producto,
    motivo: string,
    usuario?: string,
  ) {
    const historialRepo = manager.getRepository(ProductoPrecioHistorial);

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

  private parseBool(v: any, def = false): boolean {
    if (v === true || v === false) return v;
    if (v === null || v === undefined) return def;
    const s = String(v).trim().toLowerCase();
    return ['1', 'true', 'yes', 'si', 'on'].includes(s);
  }


  private async syncVentasCrearProducto(payload: any) {
    

    const base = String(process.env.VENTAS_API_BASE ?? '').replace(/\/+$/, '');
    const key = String(process.env.VENTAS_API_KEY ?? '').trim();

    if (!base || !key) {
      this.logger.warn('VENTAS_API_BASE/VENTAS_API_KEY no configurados.');
      return { ok: false, skipped: true, reason: 'missing_env' };
    }

    const url = `${base}/productos`;

    try {
      const r = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      });
      return { ok: true, data: r.data };
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.response?.data ??
        e?.message ??
        'Error creando producto en Ventas';

      this.logger.error(`SYNC Ventas create producto falló: ${msg}`);
      return { ok: false, error: msg };
    }
  }
}

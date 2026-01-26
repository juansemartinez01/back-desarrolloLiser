import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';



import {
  CreateBackofficeLoteDto,
  QueryBackofficeLotesDto,
  QueryBackofficeProductosPendientesDto,
  SeleccionarBackofficeDto,
  UpdateBackofficeLoteDto,
} from './dto/backoffice-lotes.dto';
import { LoteContableEstado } from '../../../modules/stock/enums/lote-contable-estado.enum';
import { LoteContable } from '../../../modules/stock/lotes-contables/entities/lote-contable.entity';
import { StockLote } from '../../../modules/stock/stock-actual/entities/stock-lote.entity';

function toDecimal4(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return Number.isFinite(v) ? v.toFixed(4) : '0.0000';
}

// Estado por total/vendida (igual que tu lógica)
function resolverEstado(total: number, vendida: number): LoteContableEstado {
  if (vendida <= 0 + 1e-9) return LoteContableEstado.SIN_VENDER;
  if (vendida >= total - 1e-9) return LoteContableEstado.VENDIDO;
  return LoteContableEstado.PARCIAL;
}

@Injectable()
export class BackofficeLotesService {
  private readonly logger = new Logger(BackofficeLotesService.name);
  constructor(private readonly ds: DataSource) {}

  // LISTAR neutro: cantidad = cantidad_tipo1
  async listar(q: QueryBackofficeLotesDto) {
    try {
      const page = q.page ?? 1;
      const limit = q.limit ?? 50;
      const skip = (page - 1) * limit;

      const repo = this.ds.getRepository(LoteContable);
      const qb = repo.createQueryBuilder('lc');

      if (q.lote_id) qb.andWhere('lc.lote_id = :lid', { lid: q.lote_id });
      if (q.estado) qb.andWhere('lc.estado = :e', { e: q.estado });

      // Ojo: devolvemos RAW para renombrar campos sin exponer tipo
      qb.select([
        'lc.id AS id',
        'lc.lote_id AS lote_id',
        'lc.empresa_factura AS empresa_factura',
        'lc.estado AS estado',

        // Backoffice: cantidad = tipo1
        'lc.cantidad_tipo1 AS cantidad',

        'lc.cantidad_vendida AS cantidad_vendida',
        'lc.cantidad_facturada AS cantidad_facturada',

        'lc.created_at AS created_at',
        'lc.updated_at AS updated_at',
        'lc.version AS version',
      ])
        .orderBy('lc.created_at', 'DESC')
        .offset(skip)
        .limit(limit);

      const data = await qb.getRawMany();

      // count separado (mismos filtros, sin select raw)
      const countQb = repo.createQueryBuilder('lc');
      if (q.lote_id) countQb.andWhere('lc.lote_id = :lid', { lid: q.lote_id });
      if (q.estado) countQb.andWhere('lc.estado = :e', { e: q.estado });
      const total = await countQb.getCount();

      return { data, total, page, limit };
    } catch (e: any) {
      this.logger.error('[GET /backoffice/lotes] error', e?.stack || String(e));
      throw new BadRequestException(
        e?.detail || e?.message || 'Error listando lotes (backoffice)',
      );
    }
  }

  async obtener(id: string) {
    try {
      const repo = this.ds.getRepository(LoteContable);

      // raw para renombrar
      const row = await repo
        .createQueryBuilder('lc')
        .select([
          'lc.id AS id',
          'lc.lote_id AS lote_id',
          'lc.empresa_factura AS empresa_factura',
          'lc.estado AS estado',
          'lc.cantidad_tipo1 AS cantidad',
          'lc.cantidad_vendida AS cantidad_vendida',
          'lc.cantidad_facturada AS cantidad_facturada',
          'lc.created_at AS created_at',
          'lc.updated_at AS updated_at',
          'lc.version AS version',
        ])
        .where('lc.id = :id', { id })
        .getRawOne();

      if (!row) throw new NotFoundException('Lote no encontrado');
      return row;
    } catch (e: any) {
      this.logger.error(
        `[GET /backoffice/lotes/${id}] error`,
        e?.stack || String(e),
      );
      throw new BadRequestException(
        e?.detail || e?.message || 'Error obteniendo lote (backoffice)',
      );
    }
  }

  async crear(dto: CreateBackofficeLoteDto) {
    const loteRepo = this.ds.getRepository(StockLote);
    const contRepo = this.ds.getRepository(LoteContable);

    const lote = await loteRepo.findOne({ where: { id: dto.lote_id } });
    if (!lote) {
      throw new BadRequestException(`El lote físico ${dto.lote_id} no existe`);
    }

    const yaExiste = await contRepo.findOne({
      where: { lote_id: dto.lote_id },
    });
    if (yaExiste) {
      throw new BadRequestException(
        `Ya existe un lote contable para el lote ${dto.lote_id}`,
      );
    }

    const cantidad = Number(dto.cantidad);
    if (cantidad < 0) throw new BadRequestException('cantidad inválida');

    const vendida = Number(dto.cantidad_vendida ?? 0);
    if (vendida < 0 || vendida - cantidad > 1e-9) {
      throw new BadRequestException('cantidad_vendida inválida');
    }

    const estado = resolverEstado(cantidad, vendida);

    const lc = contRepo.create({
      lote,
      lote_id: lote.id,

      // Backoffice: todo queda en tipo1
      cantidad_total: toDecimal4(cantidad),
      cantidad_tipo1: toDecimal4(cantidad),
      cantidad_tipo2: toDecimal4(0),

      cantidad_vendida: toDecimal4(vendida),
      cantidad_facturada: toDecimal4(0),

      empresa_factura: dto.empresa_factura as any,
      estado,

      created_at: new Date(),
      updated_at: new Date(),
    });

    const saved = await contRepo.save(lc);

    // devolver neutro
    return {
      id: saved.id,
      lote_id: saved.lote_id,
      empresa_factura: saved.empresa_factura,
      estado: saved.estado,
      cantidad: saved.cantidad_tipo1,
      cantidad_vendida: saved.cantidad_vendida,
      cantidad_facturada: saved.cantidad_facturada,
      created_at: saved.created_at,
      updated_at: saved.updated_at,
      version: saved.version,
    };
  }

  async actualizar(id: string, dto: UpdateBackofficeLoteDto) {
    const repo = this.ds.getRepository(LoteContable);
    const lc = await repo.findOne({ where: { id } });
    if (!lc) throw new NotFoundException('Lote no encontrado');

    let cantidad = Number(lc.cantidad_tipo1);
    let vendida = Number(lc.cantidad_vendida);

    if (dto.cantidad != null) cantidad = Number(dto.cantidad);
    if (dto.cantidad_vendida != null) vendida = Number(dto.cantidad_vendida);

    if (cantidad < 0) throw new BadRequestException('cantidad inválida');
    if (vendida < 0 || vendida - cantidad > 1e-9) {
      throw new BadRequestException('cantidad_vendida inválida');
    }

    // Backoffice: mantener consistencia total/tipo2 siempre
    lc.cantidad_total = toDecimal4(cantidad);
    lc.cantidad_tipo1 = toDecimal4(cantidad);
    lc.cantidad_tipo2 = toDecimal4(0);
    lc.cantidad_vendida = toDecimal4(vendida);

    lc.estado = resolverEstado(cantidad, vendida);

    if (dto.empresa_factura != null)
      lc.empresa_factura = dto.empresa_factura as any;

    // si NO querés permitir estado manual, borramos esto:
    if (dto.estado != null) lc.estado = dto.estado as any;

    lc.updated_at = new Date();
    const saved = await repo.save(lc);

    return {
      id: saved.id,
      lote_id: saved.lote_id,
      empresa_factura: saved.empresa_factura,
      estado: saved.estado,
      cantidad: saved.cantidad_tipo1,
      cantidad_vendida: saved.cantidad_vendida,
      cantidad_facturada: saved.cantidad_facturada,
      created_at: saved.created_at,
      updated_at: saved.updated_at,
      version: saved.version,
    };
  }

  async borrar(id: string) {
    const repo = this.ds.getRepository(LoteContable);
    const lc = await repo.findOne({ where: { id } });
    if (!lc) throw new NotFoundException('Lote no encontrado');
    await repo.remove(lc);
    return { ok: true };
  }

  /**
   * Equivale a productosConTipo1Extendido, pero neutro.
   * Devuelve: cantidad_total (antes tipo1_total), facturada_total, pendiente.
   */
  async productosPendientes(q: QueryBackofficeProductosPendientesDto) {
    const qb = this.ds
      .getRepository(LoteContable)
      .createQueryBuilder('lc')
      .innerJoin(StockLote, 'l', 'l.id = lc.lote_id')
      .innerJoin('stk_productos', 'p', 'p.id = l.producto_id')
      .leftJoin('stk_unidades', 'u', 'u.id = p.unidad_id')
      .leftJoin('stk_tipos_producto', 'tp', 'tp.id = p.tipo_producto_id')
      .select([
        'p.id AS producto_id',
        'p.nombre AS producto_nombre',
        'p.codigo_comercial AS producto_codigo_comercial',

        'p.empresa AS producto_empresa',
        'p.activo AS producto_activo',
        'p.facturable AS producto_facturable',
        'p.selector_fiscal AS producto_selector_fiscal',
        'p.categoria_fiscal AS producto_categoria_fiscal',
        'p.alicuota_iva AS producto_alicuota_iva',
        'p.exento_iva AS producto_exento_iva',

        'u.codigo AS unidad_codigo',
        'u.nombre AS unidad_nombre',

        'tp.id AS tipo_producto_id',
        'tp.nombre AS tipo_producto',

        'p.precio_compra AS precio_compra',
        'p.precio_sin_iva AS precio_sin_iva',
        'p.precio_con_iva AS precio_con_iva',

        // Backoffice: lo llamamos "cantidad_total" (pero es tipo1)
        'SUM(CAST(lc.cantidad_tipo1 AS numeric)) AS cantidad_total',

        'SUM(CAST(lc.cantidad_facturada AS numeric)) AS cantidad_facturada_total',

        '(SUM(CAST(lc.cantidad_tipo1 AS numeric)) - SUM(CAST(lc.cantidad_facturada AS numeric))) AS pendiente',
      ])
      .groupBy('p.id')
      .addGroupBy('p.nombre')
      .addGroupBy('p.codigo_comercial')
      .addGroupBy('p.empresa')
      .addGroupBy('p.activo')
      .addGroupBy('p.facturable')
      .addGroupBy('p.selector_fiscal')
      .addGroupBy('p.categoria_fiscal')
      .addGroupBy('p.alicuota_iva')
      .addGroupBy('p.exento_iva')
      .addGroupBy('p.precio_compra')
      .addGroupBy('p.precio_sin_iva')
      .addGroupBy('p.precio_con_iva')
      .addGroupBy('u.codigo')
      .addGroupBy('u.nombre')
      .addGroupBy('tp.id')
      .addGroupBy('tp.nombre')
      .having(
        '(SUM(CAST(lc.cantidad_tipo1 AS numeric)) - SUM(CAST(lc.cantidad_facturada AS numeric))) > 0',
      )
      .orderBy('p.nombre', 'ASC');

    if (q.producto_id) qb.andWhere('p.id = :pid', { pid: q.producto_id });
    if (q.tipo_producto_id)
      qb.andWhere('tp.id = :tpid', { tpid: q.tipo_producto_id });
    if (q.empresa_factura)
      qb.andWhere('lc.empresa_factura = :ef', { ef: q.empresa_factura });
    if (q.estado) qb.andWhere('lc.estado = :st', { st: q.estado });
    if (q.desde) qb.andWhere('l.fecha_remito >= :desde', { desde: q.desde });
    if (q.hasta) qb.andWhere('l.fecha_remito <= :hasta', { hasta: q.hasta });

    return qb.getRawMany();
  }

  /**
   * Igual a tu registrarFacturacion, pero conceptualmente neutro.
   * Sigue consumiendo FIFO por fecha_remito y usando cantidad_tipo1 como "cantidad".
   */
  async registrarFacturacion(producto_id: number, cantidad: number) {
    const repo = this.ds.getRepository(LoteContable);

    const lotes = await repo
      .createQueryBuilder('lc')
      .innerJoin(StockLote, 'l', 'l.id = lc.lote_id')
      .where('l.producto_id = :pid', { pid: producto_id })
      .andWhere(
        'CAST(lc.cantidad_tipo1 AS numeric) > CAST(lc.cantidad_facturada AS numeric)',
      )
      .orderBy('l.fecha_remito', 'ASC')
      .getMany();

    if (!lotes.length) {
      throw new BadRequestException('No hay cantidad disponible para facturar');
    }

    let restante = Number(cantidad);
    if (!Number.isFinite(restante) || restante <= 0) {
      throw new BadRequestException('cantidad inválida');
    }

    for (const lote of lotes) {
      if (restante <= 0) break;

      const disponible =
        Number(lote.cantidad_tipo1) - Number(lote.cantidad_facturada);

      const consumir = Math.min(disponible, restante);

      lote.cantidad_facturada = (
        Number(lote.cantidad_facturada) + consumir
      ).toFixed(4);

      // estado según total/vendida (en backoffice total=tipo1)
      const total = Number(lote.cantidad_tipo1);
      const vendida = Number(lote.cantidad_vendida);
      lote.estado = resolverEstado(total, vendida);

      await repo.save(lote);
      restante -= consumir;
    }

    if (restante > 1e-9) {
      throw new BadRequestException(
        `No hay suficiente cantidad para facturar. Faltaron ${restante.toFixed(4)}`,
      );
    }

    return { ok: true };
  }

  async seleccionarProductos(dto: SeleccionarBackofficeDto) {
    const { producto_ids, monto_objetivo } = dto;

    if (!producto_ids?.length)
      throw new BadRequestException('producto_ids requerido');
    if (monto_objetivo <= 0)
      throw new BadRequestException('monto_objetivo debe ser > 0');

    const qb = this.ds
      .getRepository(LoteContable)
      .createQueryBuilder('lc')
      .innerJoin(StockLote, 'l', 'l.id = lc.lote_id')
      .innerJoin('stk_productos', 'p', 'p.id = l.producto_id')
      .leftJoin('stk_unidades', 'u', 'u.id = p.unidad_id')
      .leftJoin('stk_tipos_producto', 'tp', 'tp.id = p.tipo_producto_id')
      .select([
        'p.id AS producto_id',
        'p.nombre AS producto_nombre',
        'p.codigo_comercial AS producto_codigo_comercial',

        'u.codigo AS unidad_codigo',
        'u.nombre AS unidad_nombre',

        'tp.id AS tipo_producto_id',
        'tp.nombre AS tipo_producto',

        'SUM(CAST(lc.cantidad_tipo1 AS numeric)) AS cantidad_total',
        'SUM(CAST(lc.cantidad_facturada AS numeric)) AS cantidad_facturada_total',
        '(SUM(CAST(lc.cantidad_tipo1 AS numeric)) - SUM(CAST(lc.cantidad_facturada AS numeric))) AS pendiente',

        'p.precio_con_iva AS precio_unitario',
      ])
      .where('p.id IN (:...ids)', { ids: producto_ids })
      .groupBy('p.id')
      .addGroupBy('u.codigo')
      .addGroupBy('u.nombre')
      .addGroupBy('tp.id')
      .addGroupBy('tp.nombre')
      .having(
        '(SUM(CAST(lc.cantidad_tipo1 AS numeric)) - SUM(CAST(lc.cantidad_facturada AS numeric))) > 0',
      )
      .orderBy('p.nombre', 'ASC');

    if (dto.empresa_factura)
      qb.andWhere('lc.empresa_factura = :ef', { ef: dto.empresa_factura });
    if (dto.estado) qb.andWhere('lc.estado = :st', { st: dto.estado });
    if (dto.desde)
      qb.andWhere('l.fecha_remito >= :desde', { desde: dto.desde });
    if (dto.hasta)
      qb.andWhere('l.fecha_remito <= :hasta', { hasta: dto.hasta });

    const rows = await qb.getRawMany<any>();
    if (!rows.length)
      throw new BadRequestException('No hay productos con pendiente > 0');

    let disponibles = rows
      .map((r: any) => ({
        ...r,
        pendiente_n: Number(r.pendiente),
        precio_n: Number(r.precio_unitario),
      }))
      .filter((r: any) => r.pendiente_n > 0 && r.precio_n > 0);

    if (!disponibles.length) {
      throw new BadRequestException(
        'No hay productos con pendiente/precio válido',
      );
    }

    disponibles = this.shuffle(disponibles);

    let restante = monto_objetivo;
    const items: any[] = [];

    const precioMin = Math.min(...disponibles.map((r: any) => r.precio_n));

    for (const prod of disponibles) {
      if (restante < precioMin) break;

      const maxQtyPorDinero =
        Math.floor((restante / prod.precio_n) * 10000) / 10000;
      const maxQty = Math.min(prod.pendiente_n, maxQtyPorDinero);
      if (maxQty <= 0) continue;

      const cantidad = maxQty;
      const subtotal = cantidad * prod.precio_n;

      items.push({
        producto_id: Number(prod.producto_id),
        producto_nombre: prod.producto_nombre,
        unidad_codigo: prod.unidad_codigo,
        unidad_nombre: prod.unidad_nombre,
        tipo_producto_id: Number(prod.tipo_producto_id),
        tipo_producto: prod.tipo_producto,
        cantidad: Number(cantidad.toFixed(4)),
        precio_unitario: Number(prod.precio_n.toFixed(4)),
        subtotal: Number(subtotal.toFixed(2)),
        pendiente_disponible_original: Number(prod.pendiente_n.toFixed(4)),
      });

      restante -= subtotal;
    }

    const total = items.reduce((acc, it) => acc + it.subtotal, 0);

    return {
      monto_objetivo,
      total_seleccionado: Number(total.toFixed(2)),
      diferencia: Number((monto_objetivo - total).toFixed(2)),
      items,
    };
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

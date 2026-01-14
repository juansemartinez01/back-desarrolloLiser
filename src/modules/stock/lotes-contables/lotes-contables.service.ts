// src/modules/stock/lotes-contables/lotes-contables.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoteContable } from './entities/lote-contable.entity';
import { StockLote } from '../stock-actual/entities/stock-lote.entity';
import {
  CreateLoteContableDto,
  UpdateLoteContableDto,
  QueryLoteContableDto,
} from './dto/lote-contable.dto';
import { LoteContableEstado } from '../enums/lote-contable-estado.enum';
import { QueryTipo1Dto } from './dto/query-tipo1.dto';
import { SeleccionarTipo1Dto } from './dto/seleccionar-tipo1.dto';

function toDecimal4(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(4);
}

function resolverEstado(total: number, vendida: number): LoteContableEstado {
  if (vendida <= 0 + 1e-9) return LoteContableEstado.SIN_VENDER;
  if (vendida >= total - 1e-9) return LoteContableEstado.VENDIDO;
  return LoteContableEstado.PARCIAL;
}

@Injectable()
export class LotesContablesService {
  private readonly logger = new Logger(LotesContablesService.name);
  constructor(private readonly ds: DataSource) {}

  // LISTAR con filtros
  async listar(q: QueryLoteContableDto) {
    try {
      const page = q.page ?? 1;
      const limit = q.limit ?? 50;
      const skip = (page - 1) * limit;

      const repo = this.ds.getRepository(LoteContable);
      const qb = repo.createQueryBuilder('lc');

      if (q.lote_id) {
        qb.andWhere('lc.lote_id = :lid', { lid: q.lote_id });
      }
      if (q.estado) {
        qb.andWhere('lc.estado = :e', { e: q.estado });
      }

      qb.orderBy('lc.created_at', 'DESC').skip(skip).take(limit);

      const [data, total] = await qb.getManyAndCount();
      return { data, total, page, limit };
    } catch (e: any) {
      this.logger.error(
        '[GET /stock/lotes-contables] error',
        e?.stack || String(e),
      );
      throw new BadRequestException(
        e?.detail || e?.message || 'Error listando lotes contables',
      );
    }
  }

  // OBTENER por id
  async obtener(id: string) {
    try {
      const lc = await this.ds
        .getRepository(LoteContable)
        .findOne({ where: { id } });
      if (!lc) throw new NotFoundException('Lote contable no encontrado');
      return lc;
    } catch (e: any) {
      this.logger.error(
        `[GET /stock/lotes-contables/${id}] error`,
        e?.stack || String(e),
      );
      throw new BadRequestException(
        e?.detail || e?.message || 'Error obteniendo lote contable',
      );
    }
  }
  // CREAR (uno por lote físico)
  async crear(dto: CreateLoteContableDto) {
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

    const total = Number(dto.cantidad_total);
    const t1 = Number(dto.cantidad_tipo1);
    const t2 = Number(dto.cantidad_tipo2);

    if (Number(toDecimal4(t1 + t2)) !== Number(toDecimal4(total))) {
      throw new BadRequestException(
        'cantidad_tipo1 + cantidad_tipo2 debe igualar cantidad_total',
      );
    }

    const vendida = Number(dto.cantidad_vendida ?? 0);
    if (vendida < 0 || vendida - total > 1e-9) {
      throw new BadRequestException(
        'cantidad_vendida debe estar entre 0 y cantidad_total',
      );
    }

    const estado = resolverEstado(total, vendida);

    const lc = contRepo.create({
      lote: lote,
      lote_id: lote.id,
      cantidad_total: toDecimal4(total),
      cantidad_tipo1: toDecimal4(t1),
      cantidad_tipo2: toDecimal4(t2),
      cantidad_vendida: toDecimal4(vendida),
      empresa_factura: dto.empresa_factura,
      estado,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return contRepo.save(lc);
  }

  // ACTUALIZAR
  async actualizar(id: string, dto: UpdateLoteContableDto) {
    const repo = this.ds.getRepository(LoteContable);
    const lc = await repo.findOne({ where: { id } });
    if (!lc) throw new NotFoundException('Lote contable no encontrado');

    let total = Number(lc.cantidad_total);
    let t1 = Number(lc.cantidad_tipo1);
    let t2 = Number(lc.cantidad_tipo2);
    let vendida = Number(lc.cantidad_vendida);

    if (dto.cantidad_total != null) total = Number(dto.cantidad_total);
    if (dto.cantidad_tipo1 != null) t1 = Number(dto.cantidad_tipo1);
    if (dto.cantidad_tipo2 != null) t2 = Number(dto.cantidad_tipo2);
    if (dto.cantidad_vendida != null) vendida = Number(dto.cantidad_vendida);

    if (Number(toDecimal4(t1 + t2)) !== Number(toDecimal4(total))) {
      throw new BadRequestException(
        'cantidad_tipo1 + cantidad_tipo2 debe igualar cantidad_total',
      );
    }

    if (vendida < 0 || vendida - total > 1e-9) {
      throw new BadRequestException(
        'cantidad_vendida debe estar entre 0 y cantidad_total',
      );
    }

    lc.cantidad_total = toDecimal4(total);
    lc.cantidad_tipo1 = toDecimal4(t1);
    lc.cantidad_tipo2 = toDecimal4(t2);
    lc.cantidad_vendida = toDecimal4(vendida);
    lc.estado = resolverEstado(total, vendida);

    if (dto.empresa_factura != null) {
      lc.empresa_factura = dto.empresa_factura as any;
    }

    lc.updated_at = new Date();

    return repo.save(lc);
  }

  // Opcional: podrías permitir "borrado lógico" si lo necesitás.
  async borrar(id: string) {
    const repo = this.ds.getRepository(LoteContable);
    const lc = await repo.findOne({ where: { id } });
    if (!lc) throw new NotFoundException('Lote contable no encontrado');

    await repo.remove(lc);
    return { ok: true };
  }

  async productosConTipo1Extendido(q: QueryTipo1Dto) {
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

        // ✅ NUEVO: empresa + campos útiles (no rompen nada)
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

        // precios administrativos del producto
        'p.precio_compra AS precio_compra',
        'p.precio_sin_iva AS precio_sin_iva',
        'p.precio_con_iva AS precio_con_iva',

        // SUM tipo1
        'SUM(CAST(lc.cantidad_tipo1 AS numeric)) AS cantidad_tipo1_total',

        // SUM facturada
        'SUM(CAST(lc.cantidad_facturada AS numeric)) AS cantidad_facturada_total',

        // pendiente = tipo1 - facturada
        '(SUM(CAST(lc.cantidad_tipo1 AS numeric)) - SUM(CAST(lc.cantidad_facturada AS numeric))) AS pendiente_facturar',
      ])
      .groupBy('p.id')
      .addGroupBy('p.nombre')
      .addGroupBy('p.codigo_comercial')

      // ✅ NUEVO: groupBy para los campos agregados
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

    // ==== FILTROS ====
    if (q.producto_id) {
      qb.andWhere('p.id = :pid', { pid: q.producto_id });
    }

    if (q.tipo_producto_id) {
      qb.andWhere('tp.id = :tpid', { tpid: q.tipo_producto_id });
    }

    if (q.empresa_factura) {
      qb.andWhere('lc.empresa_factura = :ef', { ef: q.empresa_factura });
    }

    if (q.estado) {
      qb.andWhere('lc.estado = :st', { st: q.estado });
    }

    if (q.desde) {
      qb.andWhere('l.fecha_remito >= :desde', { desde: q.desde });
    }

    if (q.hasta) {
      qb.andWhere('l.fecha_remito <= :hasta', { hasta: q.hasta });
    }

    // RESULTADO
    return qb.getRawMany();
  }

  async registrarFacturacion(producto_id: number, cantidad: number) {
    const repo = this.ds.getRepository(LoteContable);

    // Traer todos los lotes contables con tipo1 > facturado
    const lotes = await repo
      .createQueryBuilder('lc')
      .innerJoin(StockLote, 'l', 'l.id = lc.lote_id')
      .where('l.producto_id = :pid', { pid: producto_id })
      .andWhere(
        'CAST(lc.cantidad_tipo1 AS numeric) > CAST(lc.cantidad_facturada AS numeric)',
      )
      .orderBy('l.fecha_remito', 'ASC') // FIFO
      .getMany();

    if (lotes.length === 0) {
      throw new BadRequestException(
        'No hay cantidad tipo1 disponible para facturar',
      );
    }

    let restante = cantidad;

    for (const lote of lotes) {
      if (restante <= 0) break;

      const disponible =
        Number(lote.cantidad_tipo1) - Number(lote.cantidad_facturada);

      const consumir = Math.min(disponible, restante);

      lote.cantidad_facturada = (
        Number(lote.cantidad_facturada) + consumir
      ).toFixed(4);

      // Actualizar estado si es necesario
      const total = Number(lote.cantidad_total);
      const vendida = Number(lote.cantidad_vendida); // ya existe
      lote.estado = resolverEstado(total, vendida); // tu propia lógica

      await repo.save(lote);

      restante -= consumir;
    }

    if (restante > 0) {
      throw new BadRequestException(
        `No hay suficiente cantidad tipo1 para facturar. Faltaron ${restante}`,
      );
    }

    return { ok: true };
  }

  async seleccionarProductosTipo1(dto: SeleccionarTipo1Dto) {
    const { producto_ids, monto_objetivo } = dto;

    if (!producto_ids?.length) {
      throw new BadRequestException('producto_ids requerido');
    }

    if (monto_objetivo <= 0) {
      throw new BadRequestException('monto_objetivo debe ser > 0');
    }

    // 1) Traer datos agregados + precio unitario
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

        'SUM(CAST(lc.cantidad_tipo1 AS numeric)) AS cantidad_tipo1_total',
        'SUM(CAST(lc.cantidad_facturada AS numeric)) AS cantidad_facturada_total',
        '(SUM(CAST(lc.cantidad_tipo1 AS numeric)) - SUM(CAST(lc.cantidad_facturada AS numeric))) AS pendiente_facturar',

        // precio que vamos a usar para el cálculo (ajustalo si querés otro)
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

    // filtros opcionales, igual que en el otro
    if (dto.empresa_factura) {
      qb.andWhere('lc.empresa_factura = :ef', { ef: dto.empresa_factura });
    }
    if (dto.estado) {
      qb.andWhere('lc.estado = :st', { st: dto.estado });
    }
    if (dto.desde) {
      qb.andWhere('l.fecha_remito >= :desde', { desde: dto.desde });
    }
    if (dto.hasta) {
      qb.andWhere('l.fecha_remito <= :hasta', { hasta: dto.hasta });
    }

    const rows = await qb.getRawMany<{
      producto_id: number;
      producto_nombre: string;
      producto_codigo_comercial: string | null;
      unidad_codigo: string | null;
      unidad_nombre: string | null;
      tipo_producto_id: number;
      tipo_producto: string;
      cantidad_tipo1_total: string;
      cantidad_facturada_total: string;
      pendiente_facturar: string;
      precio_unitario: string;
    }>();

    if (!rows.length) {
      throw new BadRequestException(
        'No hay productos tipo1 con pendiente_facturar > 0 para los IDs enviados',
      );
    }

    // 2) Preparar datos numéricos
    let disponibles = rows
      .map((r) => ({
        ...r,
        pendiente: Number(r.pendiente_facturar),
        precio: Number(r.precio_unitario),
      }))
      .filter((r) => r.pendiente > 0 && r.precio > 0);

    if (!disponibles.length) {
      throw new BadRequestException(
        'Los productos seleccionados no tienen pendiente_facturar o precio válido',
      );
    }

    // 3) Randomizar el orden de productos (aleatoriedad)
    disponibles = this.shuffle(disponibles);

    // 4) Algoritmo greedy hasta llegar (o aproximarse) al monto
    let restante = monto_objetivo;
    const itemsSeleccionados: any[] = [];

    const precioMinimo = Math.min(...disponibles.map((r) => r.precio));

    for (const prod of disponibles) {
      if (restante < precioMinimo) break;
      if (prod.pendiente <= 0 || prod.precio <= 0) continue;

      // Máxima cantidad permitida por dinero disponible
      const maxQtyPorDinero =
        Math.floor((restante / prod.precio) * 10000) / 10000;
      const maxQty = Math.min(prod.pendiente, maxQtyPorDinero);

      if (maxQty <= 0) continue;

      const cantidad = maxQty; // si quisieras más aleatorio, acá podrías elegir random <= maxQty

      const subtotal = cantidad * prod.precio;

      itemsSeleccionados.push({
        producto_id: prod.producto_id,
        producto_nombre: prod.producto_nombre,
        unidad_codigo: prod.unidad_codigo,
        unidad_nombre: prod.unidad_nombre,
        tipo_producto_id: prod.tipo_producto_id,
        tipo_producto: prod.tipo_producto,
        cantidad: Number(cantidad.toFixed(4)),
        precio_unitario: Number(prod.precio.toFixed(4)),
        subtotal: Number(subtotal.toFixed(2)),
        pendiente_disponible_original: Number(prod.pendiente.toFixed(4)),
      });

      restante -= subtotal;
    }

    const totalSeleccionado = itemsSeleccionados.reduce(
      (acc, it) => acc + it.subtotal,
      0,
    );

    return {
      monto_objetivo,
      total_seleccionado: Number(totalSeleccionado.toFixed(2)),
      diferencia: Number((monto_objetivo - totalSeleccionado).toFixed(2)),
      items: itemsSeleccionados,
    };
  }

  // Fisher–Yates shuffle
  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

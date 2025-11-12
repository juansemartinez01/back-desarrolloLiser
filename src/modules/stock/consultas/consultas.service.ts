import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryStockActualDto } from '../stock-actual/dto/query-stock-actual.dto';
import { QueryKardexDto } from '../dto/query-kardex.dto';


function toDateOrUndefined(v?: string): Date | undefined { return v ? new Date(v) : undefined; }


@Injectable()
export class StockQueriesService {
  constructor(private readonly ds: DataSource) {}

  async getStockActual(q: QueryStockActualDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.ds
      .createQueryBuilder()
      .from('stk_stock_actual', 'sa')
      .innerJoin('stk_productos', 'p', 'p.id = sa.producto_id')
      .leftJoin('stk_unidades', 'u', 'u.id = p.unidad_id')
      .leftJoin('stk_tipos_producto', 'tp', 'tp.id = p.tipo_producto_id')
      .select([
        'sa.id              AS sa_id',
        'sa.producto_id     AS sa_producto_id',
        'sa.almacen_id      AS sa_almacen_id',
        'sa.cantidad        AS sa_cantidad',

        // producto
        'p.id               AS prod_id',
        'p.nombre           AS prod_nombre',
        'p.codigo_comercial AS prod_codigo_comercial',
        'p.unidad_id        AS prod_unidad_id',
        'p.tipo_producto_id AS prod_tipo_producto_id',
        'p.precio_base      AS prod_precio_base',
        'p.precio_oferta    AS prod_precio_oferta',
        'p.oferta           AS prod_oferta',
        'p.vacio            AS prod_vacio',
        'p.empresa          AS prod_empresa',

        // unidad
        'u.id               AS unidad_id',
        'u.codigo           AS unidad_codigo',
        'u.nombre           AS unidad_nombre',
        'u.abreviatura      AS unidad_abreviatura',

        // tipo de producto
        'tp.id              AS tipo_id',
        'tp.nombre          AS tipo_nombre',
        'tp.descripcion     AS tipo_descripcion',
      ]);

    if (q.producto_id) {
      qb.andWhere('sa.producto_id = :pid', { pid: q.producto_id });
    }
    if (q.almacen_id) {
      qb.andWhere('sa.almacen_id = :aid', { aid: q.almacen_id });
    }

    qb.orderBy('sa.producto_id', 'ASC')
      .addOrderBy('sa.almacen_id', 'ASC')
      .limit(limit)
      .offset(skip);

    const [rows, total] = await Promise.all([
      qb.getRawMany(),
      this.ds
        .createQueryBuilder()
        .from('stk_stock_actual', 'x')
        .select('COUNT(1)', 'c')
        .where(
          q.producto_id ? 'x.producto_id = :pid' : '1=1',
          q.producto_id ? { pid: q.producto_id } : {},
        )
        .andWhere(
          q.almacen_id ? 'x.almacen_id = :aid' : '1=1',
          q.almacen_id ? { aid: q.almacen_id } : {},
        )
        .getRawOne()
        .then((r: any) => Number(r.c) || 0),
    ]);

    // Armar respuesta “linda”
    const data = rows.map((r: any) => ({
      id: r.sa_id,
      producto_id: r.sa_producto_id,
      almacen_id: r.sa_almacen_id,
      cantidad: r.sa_cantidad,

      producto: {
        id: r.prod_id,
        nombre: r.prod_nombre,
        codigo_comercial: r.prod_codigo_comercial,
        unidad_id: r.prod_unidad_id,
        tipo_producto_id: r.prod_tipo_producto_id,
        precio_base: r.prod_precio_base,
        precio_oferta: r.prod_precio_oferta,
        oferta: r.prod_oferta,
        vacio: r.prod_vacio,
        empresa: r.prod_empresa,
      },

      unidad: r.unidad_id && {
        id: r.unidad_id,
        codigo: r.unidad_codigo,
        nombre: r.unidad_nombre,
        abreviatura: r.unidad_abreviatura,
      },

      tipo_producto: r.tipo_id && {
        id: r.tipo_id,
        nombre: r.tipo_nombre,
        descripcion: r.tipo_descripcion,
      },
    }));

    return { data, total, page, limit };
  }
  async getKardex(q: QueryKardexDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;
    const order = q.order ?? 'DESC';

    const desde = toDateOrUndefined(q.desde);
    const hasta = toDateOrUndefined(q.hasta);

    const baseWhere: string[] = ['d.producto_id = :pid'];
    const params: any = { pid: q.producto_id };

    if (desde) {
      baseWhere.push('m.fecha >= :desde');
      params.desde = desde;
    }
    if (hasta) {
      baseWhere.push('m.fecha < :hasta');
      params.hasta = hasta;
    }

    // Filtro por almacén: entradas miran destino, salidas miran origen
    if (q.almacen_id) {
      baseWhere.push(`(
(d.efecto = 1 AND m.almacen_destino_id = :alm) OR
(d.efecto = -1 AND m.almacen_origen_id = :alm)
)`);
      params.alm = q.almacen_id;
    }
    const whereExpr = baseWhere.join(' AND ');

    // Datos paginados
    const listQb = this.ds
      .createQueryBuilder()
      .from('stk_movimientos_det', 'd')
      .innerJoin('stk_movimientos', 'm', 'm.id = d.movimiento_id')
      .select([
        'm.id AS movimiento_id',
        'm.tipo AS tipo',
        'm.fecha AS fecha',
        'm.almacen_origen_id AS almacen_origen_id',
        'm.almacen_destino_id AS almacen_destino_id',
        'd.id AS detalle_id',
        'd.producto_id AS producto_id',
        'd.lote_id AS lote_id',
        'd.cantidad AS cantidad',
        'd.efecto AS efecto',
      ])
      .where(whereExpr, params)
      .orderBy('m.fecha', order as any)
      .addOrderBy('d.id', order as any)
      .limit(limit)
      .offset(skip);

    const rows = await listQb.getRawMany();
    // Agregados (sumas y saldo)
    const aggQb = this.ds
      .createQueryBuilder()
      .from('stk_movimientos_det', 'd')
      .innerJoin('stk_movimientos', 'm', 'm.id = d.movimiento_id')
      .select(
        'COALESCE(SUM(CASE WHEN d.efecto = 1 THEN d.cantidad ELSE 0 END), 0)',
        'sum_entrada',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN d.efecto = -1 THEN d.cantidad ELSE 0 END), 0)',
        'sum_salida',
      )
      .where(whereExpr, params);

    const agg = await aggQb.getRawOne();

    const entrada = Number(agg?.sum_entrada || 0);
    const salida = Number(agg?.sum_salida || 0);
    const saldo = +(entrada - salida).toFixed(4);

    // Total para paginación
    const countQb = this.ds
      .createQueryBuilder()
      .from('stk_movimientos_det', 'd')
      .innerJoin('stk_movimientos', 'm', 'm.id = d.movimiento_id')
      .select('COUNT(1)', 'c')
      .where(whereExpr, params);
    const total = await countQb.getRawOne().then((r: any) => Number(r.c) || 0);
    // Decorar filas con entrada/salida
    const data = rows.map((r) => ({
      movimiento_id: r.movimiento_id,
      detalle_id: r.detalle_id,
      fecha: r.fecha,
      tipo: r.tipo,
      almacen_origen_id: r.almacen_origen_id,
      almacen_destino_id: r.almacen_destino_id,
      producto_id: r.producto_id,
      lote_id: r.lote_id,
      cantidad: r.cantidad,
      entrada: r.efecto === 1 ? r.cantidad : 0,
      salida: r.efecto === -1 ? r.cantidad : 0,
    }));

    return { data, total, page, limit, entrada, salida, saldo };
  }
}
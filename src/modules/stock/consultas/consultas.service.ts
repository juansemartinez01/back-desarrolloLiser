import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryStockActualDto } from './dto/query-stock-actual.dto';
import { QueryKardexDto } from './dto/query-kardex.dto';


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
      .select(['sa.id', 'sa.producto_id', 'sa.almacen_id', 'sa.cantidad']);

    if (q.producto_id)
      qb.andWhere('sa.producto_id = :pid', { pid: q.producto_id });
    if (q.almacen_id)
      qb.andWhere('sa.almacen_id = :aid', { aid: q.almacen_id });
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

    return { data: rows, total, page, limit };
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
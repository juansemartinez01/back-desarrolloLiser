import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryStockActualDto } from '../stock-actual/dto/query-stock-actual.dto';
import { QueryKardexDto } from '../dto/query-kardex.dto';
import { QueryLotesPorProductoDto } from './dto/query-lotes-por-producto.dto';
import { QueryStockPorAlmacenesDto } from './dto/query-stock-por-almacenes.dto';


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

  /**
   * Lotes de un producto con su distribución por almacén.
   * - Sólo lotes con cantidad_disponible > 0
   * - Si viene almacen_id, exige que el lote tenga stock disponible en ese almacén
   * - Paginado y orden por fecha_remito
   */
  async lotesPorProducto(q: QueryLotesPorProductoDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(500, Math.max(1, Number(q.limit ?? 50)));
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Armamos condiciones y parámetros en forma indexada (para evitar inyección y reutilizar)
    const whereParts: string[] = [
      `l.producto_id = $1`,
      `l.cantidad_disponible > 0`,
    ];
    const params: any[] = [q.producto_id];

    // Filtro opcional por almacén: debe existir distribución disponible en ese almacén
    if (q.almacen_id) {
      whereParts.push(`
        EXISTS (
          SELECT 1
          FROM public.stk_lote_almacen la2
          WHERE la2.lote_id = l.id
            AND la2.almacen_id = $2
            AND la2.cantidad_disponible > 0
        )
      `);
      params.push(q.almacen_id);
    }

    const where = whereParts.join(' AND ');
    const idxLimit = params.length + 1;
    const idxOffset = params.length + 2;

    // Consulta principal: usa un CTE que agrega la distribución por almacén (solo disponibles > 0)
    const sql = `
      WITH dist AS (
        SELECT
          la.lote_id,
          jsonb_agg(
            jsonb_build_object(
              'almacen_id', la.almacen_id,
              'cantidad', la.cantidad_disponible
            )
            ORDER BY la.almacen_id
          ) AS distribucion
        FROM public.stk_lote_almacen la
        WHERE la.cantidad_disponible > 0
        GROUP BY la.lote_id
      )
      SELECT
        l.id                    AS lote_id,
        l.producto_id           AS producto_id,
        l.fecha_remito          AS fecha_remito,
        l.lote_tipo             AS lote_tipo,
        l.cantidad_inicial      AS cantidad_inicial,
        l.cantidad_disponible   AS cantidad_disponible,
        d.distribucion          AS distribucion
      FROM public.stk_lotes l
      LEFT JOIN dist d ON d.lote_id = l.id
      WHERE ${where}
      ORDER BY l.fecha_remito ${order}, l.id ${order}
      LIMIT $${idxLimit} OFFSET $${idxOffset};
    `;

    const countSql = `
      SELECT COUNT(1)::int AS c
      FROM public.stk_lotes l
      WHERE ${where};
    `;

    const [rows, total] = await Promise.all([
      this.ds.query(sql, [...params, limit, offset]),
      this.ds
        .query(countSql, params)
        .then((r) => (r?.[0]?.c ? Number(r[0].c) : 0)),
    ]);

    // Normalizamos cantidades a number y distribuimos estructura
    const data = (rows as any[]).map((r) => ({
      lote_id: r.lote_id,
      producto_id: Number(r.producto_id),
      fecha_remito: r.fecha_remito,
      lote_tipo: r.lote_tipo ? Number(r.lote_tipo) : null,
      cantidad_inicial: Number(r.cantidad_inicial ?? 0),
      cantidad_disponible: Number(r.cantidad_disponible ?? 0),
      distribucion: Array.isArray(r.distribucion)
        ? r.distribucion.map((x: any) => ({
            almacen_id: Number(x.almacen_id),
            cantidad: Number(x.cantidad ?? 0),
          }))
        : [],
    }));

    return { data, total, page, limit };
  }

  async stockPorAlmacenes(q: any) {
    if (!q.almacenes) {
      throw new BadRequestException('Debe enviar ?almacenes=1,2,3');
    }

    // convertir string → array de enteros
    const almacenIds = q.almacenes
      .split(',')
      .map((v: string) => Number(v.trim()))
      .filter((v) => !isNaN(v));

    if (!almacenIds.length) {
      throw new BadRequestException('Formato inválido de almacenes');
    }

    const placeholders = almacenIds.map((_, i) => `$${i + 1}`).join(',');

    const sql = `
    SELECT 
      p.id AS producto_id,
      p.nombre AS nombre,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'almacen_id', sa.almacen_id,
            'cantidad', sa.cantidad
          ) ORDER BY sa.almacen_id
        ) FILTER (WHERE sa.almacen_id IS NOT NULL),
        '[]'::jsonb
      ) AS almacenes
    FROM public.stk_productos p
    LEFT JOIN public.stk_stock_actual sa
      ON sa.producto_id = p.id
     AND sa.almacen_id IN (${placeholders})
    GROUP BY p.id, p.nombre
    ORDER BY p.id;
  `;

    const rows = await this.ds.query(sql, almacenIds);

    const data = rows.map((r: any) => {
      const almacenes = (r.almacenes ?? []).map((a: any) => ({
        almacen_id: a.almacen_id,
        cantidad: Number(a.cantidad ?? 0),
      }));

      return {
        producto_id: r.producto_id,
        nombre: r.nombre,
        almacenes,
        total: almacenes.reduce((sum, a) => sum + a.cantidad, 0),
      };
    });

    return { data };
  }

  private async mapAlmacenIdsToUuids(intIds: number[]): Promise<string[]> {
    if (!intIds.length) return [];

    const placeholders = intIds.map((_, i) => `$${i + 1}`).join(',');

    const rows = await this.ds.query(
      `
      SELECT id
      FROM public.stk_almacenes
      WHERE almacen_id IN (${placeholders})
        AND activo = true
    `,
      intIds,
    );

    // devolvemos solo los UUID
    return rows.map((r: any) => r.id);
  }
}
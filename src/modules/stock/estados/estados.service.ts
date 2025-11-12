import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryRemitosEstadoDto } from '../remitos/dto/query-remitos-estado.dto';
import { ConciliarPendientesDto } from '../dto/conciliar-pendientes.dto';
import { MovimientoStock } from '../movimientos/entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from '../movimientos/entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from '../enums/movimiento-tipo.enum';


@Injectable()
export class EstadosService {
  constructor(private readonly ds: DataSource) {}

  // Listado con estado, % y antigüedad (SQL directo y parametrizado)
  async listarRemitosConEstado(q: QueryRemitosEstadoDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // ---- Filtros base (por remito) ----
    const baseConds: string[] = ['1=1'];
    const baseParams: any[] = [];
    let p = 1;

    if (q.desde) {
      baseConds.push(`r.fecha_remito >= $${p++}`);
      baseParams.push(new Date(q.desde));
    }
    if (q.hasta) {
      baseConds.push(`r.fecha_remito <  $${p++}`);
      baseParams.push(new Date(q.hasta));
    }
    if (q.proveedor_id !== undefined && q.proveedor_id !== null) {
      baseConds.push(`r.proveedor_id = $${p++}`);
      baseParams.push(q.proveedor_id);
    }
    if (q.numero_remito && q.numero_remito.trim()) {
      baseConds.push(`r.numero_remito ILIKE $${p++}`);
      baseParams.push(`%${q.numero_remito.trim()}%`);
    }

    const whereBase = baseConds.join(' AND ');

    // ---- Filtro por estado (se aplica sobre el SELECT final) ----
    const estadoParams: any[] = [];
    let estadoWhere = '';
    if (q.estado) {
      estadoWhere = `WHERE estado = $${p++}`;
      estadoParams.push(q.estado);
    }

    // índices para LIMIT/OFFSET
    const idxLimit = p++;
    const idxOffset = p++;

    // ---- SQL principal ----
    const baseSql = `
    WITH base AS (
      SELECT r.id,
             r.fecha_remito,
             r.numero_remito,
             r.proveedor_id,
             r.proveedor_nombre,
             COALESCE(SUM(ri.cantidad_total),0)::numeric AS total_remito
      FROM public.stk_remitos r
      JOIN public.stk_remito_items ri ON ri.remito_id = r.id
      WHERE ${whereBase}
      GROUP BY r.id
    ),
    dist AS (
      SELECT ri.remito_id,
             COALESCE(SUM(la.cantidad_asignada),0)::numeric AS distribuido
      FROM public.stk_remito_items ri
      JOIN public.stk_lotes l        ON l.remito_item_id = ri.id
      LEFT JOIN public.stk_lote_almacen la ON la.lote_id = l.id
      GROUP BY ri.remito_id
    ),
    vend AS (
      SELECT ri.remito_id,
             COALESCE(SUM(md.cantidad),0)::numeric AS total_vendido
      FROM public.stk_remito_items ri
      JOIN public.stk_lotes l            ON l.remito_item_id = ri.id
      JOIN public.stk_movimientos_det md ON md.lote_id = l.id
      JOIN public.stk_movimientos m      ON m.id = md.movimiento_id
      WHERE md.efecto = -1 AND m.tipo = 'VENTA'
      GROUP BY ri.remito_id
    ),
    disp AS (
      SELECT ri.remito_id,
             COALESCE(SUM(l.cantidad_disponible),0)::numeric AS disponible
      FROM public.stk_remito_items ri
      JOIN public.stk_lotes l ON l.remito_item_id = ri.id
      GROUP BY ri.remito_id
    ),
    final AS (
      SELECT
        b.id AS remito_id,
        b.fecha_remito,
        b.numero_remito,
        b.proveedor_id,
        b.proveedor_nombre,
        b.total_remito,
        COALESCE(d.distribuido,0)::numeric   AS distribuido,
        COALESCE(v.total_vendido,0)::numeric AS total_vendido,
        COALESCE(s.disponible,0)::numeric    AS disponible,
        CASE
          WHEN COALESCE(v.total_vendido,0) >= b.total_remito - 0.00005 THEN 'VENDIDO'
          WHEN COALESCE(v.total_vendido,0) = 0 THEN 'SIN_VENDER'
          ELSE 'PARCIAL'
        END AS estado,
        ROUND(
          CASE WHEN b.total_remito > 0
               THEN (COALESCE(v.total_vendido,0) / b.total_remito) * 100
               ELSE 0 END::numeric, 2
        ) AS porcentaje_vendido,
        (CURRENT_DATE - DATE(b.fecha_remito))::int AS antiguedad_dias,
        (b.total_remito - COALESCE(v.total_vendido,0))::numeric AS saldo_pendiente
      FROM base b
      LEFT JOIN dist d ON d.remito_id = b.id
      LEFT JOIN vend v ON v.remito_id = b.id
      LEFT JOIN disp s ON s.remito_id = b.id
    )
    SELECT *
    FROM final
    ${estadoWhere}
    ORDER BY fecha_remito ${order}, numero_remito ${order}
    LIMIT $${idxLimit} OFFSET $${idxOffset};
  `;

    // ---- SQL para total ----
    const countSql = `
    WITH base AS (
      SELECT r.id,
             COALESCE(SUM(ri.cantidad_total),0)::numeric AS total_remito
      FROM public.stk_remitos r
      JOIN public.stk_remito_items ri ON ri.remito_id = r.id
      WHERE ${whereBase}
      GROUP BY r.id
    ),
    vend AS (
      SELECT ri.remito_id,
             COALESCE(SUM(md.cantidad),0)::numeric AS total_vendido
      FROM public.stk_remito_items ri
      JOIN public.stk_lotes l            ON l.remito_item_id = ri.id
      JOIN public.stk_movimientos_det md ON md.lote_id = l.id
      JOIN public.stk_movimientos m      ON m.id = md.movimiento_id
      WHERE md.efecto = -1 AND m.tipo = 'VENTA'
      GROUP BY ri.remito_id
    ),
    final AS (
      SELECT
        b.id,
        b.total_remito,
        COALESCE(v.total_vendido,0)::numeric AS total_vendido,
        CASE
          WHEN COALESCE(v.total_vendido,0) >= b.total_remito - 0.00005 THEN 'VENDIDO'
          WHEN COALESCE(v.total_vendido,0) = 0 THEN 'SIN_VENDER'
          ELSE 'PARCIAL'
        END AS estado
      FROM base b
      LEFT JOIN vend v ON v.remito_id = b.id
    )
    SELECT COUNT(1)::int AS c
    FROM final
    ${estadoWhere};
  `;

    // ---- Ejecutar ----
    const dataParams = [...baseParams, ...estadoParams, limit, offset];
    const countParams = [...baseParams, ...estadoParams];

    try {
      const rows = await this.ds.query(baseSql, dataParams);
      const total = (await this.ds.query(countSql, countParams))?.[0]?.c ?? 0;
      return { data: rows, total: Number(total), page, limit };
    } catch (e: any) {
      console.error(
        '[GET /stock/remitos] estados error:',
        e?.detail || e?.message || e,
      );
      throw new BadRequestException(
        e?.detail || e?.message || 'Error listando remitos con estado',
      );
    }
  }

  // Detalle por remito (por ítem)
  async detalleRemito(id: string) {
    const rem = await this.ds.query(`SELECT * FROM stk_remitos WHERE id = $1`, [
      id,
    ]);
    if (!rem?.length) throw new NotFoundException('Remito no encontrado');

    const items = await this.ds.query(
      `
WITH ventas_por_lote AS (
SELECT l.remito_item_id, SUM(d.cantidad) AS vendido
FROM stk_lotes l
LEFT JOIN stk_movimientos_det d ON d.lote_id = l.id AND d.efecto = -1
LEFT JOIN stk_movimientos m ON m.id = d.movimiento_id AND m.tipo = 'VENTA'
WHERE l.remito_item_id IN (SELECT id FROM stk_remito_items WHERE remito_id = $1)
GROUP BY l.remito_item_id
)
SELECT ri.id AS remito_item_id, ri.producto_id, ri.unidad, ri.cantidad_total,
COALESCE(v.vendido,0) AS vendido,
(ri.cantidad_total - COALESCE(v.vendido,0)) AS saldo,
CASE WHEN COALESCE(v.vendido,0) = 0 THEN 'SIN_VENDER'
WHEN COALESCE(v.vendido,0) >= ri.cantidad_total THEN 'VENDIDO'
ELSE 'PARCIAL' END AS estado
FROM stk_remito_items ri
LEFT JOIN ventas_por_lote v ON v.remito_item_id = ri.id
WHERE ri.remito_id = $1
ORDER BY ri.created_at ASC;
`,
      [id],
    );

    return { remito: rem[0], items };
  }
  // Reporte de pendientes (agrupado por producto)
  async reportePendientes() {
    const rows = await this.ds.query(`
SELECT producto_id, SUM(cantidad_pendiente)::numeric(18,4) AS cantidad_pendiente,
MIN(fecha) AS desde, MAX(fecha) AS hasta, COUNT(1) AS cant_registros
FROM stk_consumos_pendientes
WHERE cantidad_pendiente > 0
GROUP BY producto_id
ORDER BY desde ASC;
`);
    return { data: rows };
  }
  // Conciliación de pendientes contra lotes disponibles (no toca stock_actual)
  async conciliarPendientes(dto: ConciliarPendientesDto) {
    const max = dto.max_filas ?? 200;

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // 1) Traer pendientes ordenados por antigüedad
      const pend = await qr.manager.query(
        `
SELECT * FROM stk_consumos_pendientes
WHERE cantidad_pendiente > 0
${dto.producto_id ? 'AND producto_id = $1' : ''}
ORDER BY fecha ASC
LIMIT ${max};
`,
        dto.producto_id ? [dto.producto_id] : [],
      );

      if (!pend.length) {
        await qr.rollbackTransaction();
        return { ok: true, conciliado: 0, detalles: [] };
      }
      // 2) Movimiento de conciliación (AJUSTE)
      const movRepo = qr.manager.getRepository(MovimientoStock);
      const detRepo = qr.manager.getRepository(MovimientoStockDetalle);
      const mov = movRepo.create({
        tipo: MovimientoTipo.AJUSTE,
        fecha: new Date(),
        referencia_tipo: 'CONCILIACION',
        referencia_id: 'RUN-' + Date.now(),
        observacion:
          'Conciliación de consumos pendientes contra lotes disponibles',
      });
      await movRepo.save(mov);

      let totalConc = 0;
      const detallesOut: any[] = [];

      for (const p of pend) {
        let restante = Number(p.cantidad_pendiente);
        // Lotes disponibles para el producto
        const lotes = await qr.manager.query(
                    `
          SELECT * FROM stk_lotes
          WHERE producto_id = $1
            AND cantidad_disponible > 0
            AND bloqueado = false
          ORDER BY fecha_remito ASC, created_at ASC;
          `,
          [p.producto_id],
        );


        for (const l of lotes) {
          if (restante <= 1e-9) break;
          const disp = Number(l.cantidad_disponible);
          if (disp <= 0) continue;
          const toma = Math.min(restante, disp);

          // Crear detalle de salida para enlazar pendiente→lote
          const det = detRepo.create({
            movimiento: mov,
            producto_id: p.producto_id,
            lote_id: l.id,
            cantidad: toma.toFixed(4),
            efecto: -1,
          });
          await detRepo.save(det);

          // Bajar disponibilidad del lote
          const newDisp = (disp - toma).toFixed(4);
          await qr.manager.query(
            `UPDATE stk_lotes SET cantidad_disponible = $1 WHERE id = $2`,
            [newDisp, l.id],
          );

          restante = Number((restante - toma).toFixed(4));
          totalConc += toma;
          detallesOut.push({
            pendiente_id: p.id,
            producto_id: p.producto_id,
            lote_id: l.id,
            cantidad: toma.toFixed(4),
          });
        }

        // Actualizar pendiente (deja 0 si quedó cubierto)
        const nuevoPend = Math.max(0, Number(p.cantidad_pendiente) - totalConc);
        const resta = Number(p.cantidad_pendiente) - restante;
        await qr.manager.query(
          `UPDATE stk_consumos_pendientes SET cantidad_pendiente = $1 WHERE id = $2`,
          [Math.max(0, Number(p.cantidad_pendiente) - resta).toFixed(4), p.id],
        );
      }
      await qr.commitTransaction();
      return {
        ok: true,
        conciliado: Number(totalConc.toFixed(4)),
        detalles: detallesOut,
      };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }
}
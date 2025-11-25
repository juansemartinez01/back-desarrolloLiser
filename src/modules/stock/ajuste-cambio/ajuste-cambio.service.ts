import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AjusteCambioDto } from './dto/ajuste-cambio.dto';
import { MovimientoStock } from '../movimientos/entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from '../movimientos/entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from '../enums/movimiento-tipo.enum';
import { AjusteCambioFiltrosDto } from './dto/ajuste-cambio-filtros.dto';

@Injectable()
export class AjusteCambioService {
  constructor(private readonly ds: DataSource) {}

  async registrarAjusteCambio(dto: AjusteCambioDto) {
    if (!dto.devoluciones?.length && !dto.entregas?.length) {
      throw new BadRequestException(
        'El ajuste debe tener devoluciones o entregas',
      );
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const fecha = new Date();

      // Crear movimiento general
      const mov = await qr.manager.save(
        qr.manager.create(MovimientoStock, {
          tipo: MovimientoTipo.AJUSTE_POR_CAMBIO,
          fecha,
          almacen_origen_id: dto.almacen_id,
          almacen_destino_id: dto.almacen_id,
          referencia_tipo: 'AJUSTE_CAMBIO',
          referencia_id: dto.referencia_venta_id,
          observacion: dto.observacion ?? null,
        }),
      );

      type AjusteCambioDetalleResumen = {
        tipo: 'DEVOLUCION' | 'ENTREGA';
        producto_id: number;
        lote_id: string;
        cantidad: string;
        almacen_id: number;
      };
      const detallesResumen: AjusteCambioDetalleResumen[] = [];

      // Helpers
      const upsertStockActual = async (
        productoId: number,
        almacenId: number,
        delta: number,
      ) => {
        await qr.query(
          `
          INSERT INTO public.stk_stock_actual (producto_id, almacen_id, cantidad)
          VALUES ($1, $2, $3)
          ON CONFLICT (producto_id, almacen_id)
          DO UPDATE SET cantidad = public.stk_stock_actual.cantidad + EXCLUDED.cantidad
          `,
          [productoId, almacenId, delta.toFixed(4)],
        );
      };

      const addToLoteAlmacen = async (
        loteId: string,
        almacenId: number,
        delta: number,
      ) => {
        const d = delta.toFixed(4);
        await qr.query(
          `
          INSERT INTO public.stk_lote_almacen (lote_id, almacen_id, cantidad_asignada, cantidad_disponible)
          VALUES ($1, $2, 0, $3)
          ON CONFLICT (lote_id, almacen_id)
          DO UPDATE SET cantidad_disponible =
                public.stk_lote_almacen.cantidad_disponible + EXCLUDED.cantidad_disponible
        `,
          [loteId, almacenId, d],
        );
      };

      const updateLoteGlobal = async (loteId: string, delta: number) => {
        await qr.query(
          `
          UPDATE public.stk_lotes
             SET cantidad_disponible = cantidad_disponible + $2
           WHERE id = $1
        `,
          [loteId, delta.toFixed(4)],
        );
      };

      // ===========================================
      // ============ 1) DEVOLUCIONES ==============
      // ===========================================
      for (const dev of dto.devoluciones) {
        const pid = dev.producto_id;
        const alm = dto.almacen_id;
        const cant = Number(dev.cantidad);

        const loteId = dev.lote_id;
        if (!loteId) {
          throw new BadRequestException(
            'Para devoluciones se requiere lote_id',
          );
        }

        await addToLoteAlmacen(loteId, alm, cant);
        await updateLoteGlobal(loteId, cant);
        await upsertStockActual(pid, alm, cant);

        const det = qr.manager.create(MovimientoStockDetalle, {
          movimiento: mov,
          producto_id: pid,
          lote_id: loteId,
          cantidad: cant.toFixed(4),
          efecto: +1,
        });
        await qr.manager.save(det);

        detallesResumen.push({
          tipo: 'DEVOLUCION',
          producto_id: pid,
          lote_id: loteId,
          cantidad: cant.toFixed(4),
          almacen_id: alm,
        });
      }

      // ===========================================
      // ============= 2) ENTREGAS =================
      // ===========================================
      for (const ent of dto.entregas) {
        const pid = ent.producto_id;
        const alm = dto.almacen_id;
        let restante = Number(ent.cantidad);

        while (restante > 1e-9) {
          const rows = await qr.query(
            `
            SELECT la.lote_id, la.cantidad_disponible
            FROM public.stk_lote_almacen la
            JOIN public.stk_lotes l ON l.id = la.lote_id
            WHERE la.almacen_id = $1
              AND l.producto_id = $2
              AND la.cantidad_disponible > 0
            ORDER BY l.fecha_remito ASC, l.created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        `,
            [alm, pid],
          );

          if (!rows.length)
            throw new BadRequestException(
              `Stock insuficiente en almacén ${alm} para producto ${pid}`,
            );

          const lote = rows[0];
          const disp = Number(lote.cantidad_disponible);

          const toma = Math.min(restante, disp);
          const tomaStr = toma.toFixed(4);

          await addToLoteAlmacen(lote.lote_id, alm, -toma);
          await updateLoteGlobal(lote.lote_id, -toma);
          await upsertStockActual(pid, alm, -toma);

          const det = qr.manager.create(MovimientoStockDetalle, {
            movimiento: mov,
            producto_id: pid,
            lote_id: lote.lote_id,
            cantidad: tomaStr,
            efecto: -1,
          });
          await qr.manager.save(det);

          detallesResumen.push({
            tipo: 'ENTREGA',
            producto_id: pid,
            lote_id: lote.lote_id,
            cantidad: tomaStr,
            almacen_id: alm,
          });

          restante = Number((restante - toma).toFixed(4));
        }
      }

      await qr.commitTransaction();

      return {
        ok: true,
        movimiento_id: mov.id,
        detalles: detallesResumen,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /* -------------------------
     GET — LISTAR AJUSTES
  -------------------------- */
  async listarAjustesCambio(filtros: AjusteCambioFiltrosDto) {
    const page = filtros.page ? Number(filtros.page) : 1;
    const limit = filtros.limit ? Number(filtros.limit) : 20;
    const offset = (page - 1) * limit;

    const params: any[] = [];
    let where = `m.tipo = '${MovimientoTipo.AJUSTE_POR_CAMBIO}'`;

    if (filtros.referencia_venta_id) {
      params.push(filtros.referencia_venta_id);
      where += ` AND m.referencia_id = $${params.length}`;
    }

    if (filtros.fecha_desde) {
      params.push(filtros.fecha_desde);
      where += ` AND m.fecha >= $${params.length}`;
    }

    if (filtros.fecha_hasta) {
      params.push(filtros.fecha_hasta);
      where += ` AND m.fecha <= $${params.length}`;
    }

    if (filtros.producto_id) {
      params.push(filtros.producto_id);
      where += ` AND d.producto_id = $${params.length}`;
    }

    const rows = await this.ds.query(
      `
      SELECT
        m.id AS movimiento_id,
        m.fecha,
        m.referencia_id,
        m.observacion,
        d.producto_id,
        d.lote_id,
        d.cantidad,
        d.efecto
      FROM public.stk_movimientos m
      JOIN public.stk_movimiento_detalles d ON d.movimiento_id = m.id
      WHERE ${where}
      ORDER BY m.fecha DESC
      LIMIT ${limit}
      OFFSET ${offset}
      `,
      params,
    );

    // AGRUPAR POR MOVIMIENTO
    const movimientosMap = new Map();

    for (const r of rows) {
      if (!movimientosMap.has(r.movimiento_id)) {
        movimientosMap.set(r.movimiento_id, {
          movimiento_id: r.movimiento_id,
          fecha: r.fecha,
          referencia_id: r.referencia_id,
          observacion: r.observacion,
          devoluciones: [],
          entregas: [],
        });
      }

      const mov = movimientosMap.get(r.movimiento_id);

      if (Number(r.efecto) === 1) {
        mov.devoluciones.push({
          producto_id: r.producto_id,
          lote_id: r.lote_id,
          cantidad: r.cantidad,
        });
      } else {
        mov.entregas.push({
          producto_id: r.producto_id,
          lote_id: r.lote_id,
          cantidad: r.cantidad,
        });
      }
    }

    return {
      ok: true,
      page,
      limit,
      total: movimientosMap.size,
      movimientos: Array.from(movimientosMap.values()),
    };
  }
}

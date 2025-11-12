import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RegistrarVentaDto } from './dto/venta.dto';
import { MovimientoStock } from './entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from './entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from '../enums/movimiento-tipo.enum';

@Injectable()
export class VentasService {
  constructor(private readonly ds: DataSource) {}

  async registrarVenta(dto: RegistrarVentaDto) {
    if (!dto.lineas?.length) {
      throw new BadRequestException('La venta debe tener al menos una línea');
    }

    dto.lineas.forEach((l, idx) => {
      if (!(Number(l.cantidad) > 0)) {
        throw new BadRequestException(
          `La cantidad de la línea ${idx + 1} debe ser > 0`,
        );
      }
    });

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

      // Cabecera movimiento
      const mov = await qr.manager.save(
        qr.manager.create(MovimientoStock, {
          tipo: MovimientoTipo.VENTA,
          fecha,
          almacen_origen_id: dto.almacen_origen_id, // se usa por detalle
          almacen_destino_id: null,
          referencia_tipo: 'VENTA',
          referencia_id: dto.referencia_id ?? null,
          observacion: dto.observacion ?? null,
        }),
      );

      const detallesResumen: Array<{
        producto_id: number;
        lote_id: string;
        cantidad: string;
        almacen_id: number;
      }> = [];

      // Helpers
      const actualizarStockActual = async (
        productoId: number,
        almacenId: number,
        deltaNegativo: number,
      ) => {
        const deltaStr = Number(deltaNegativo).toFixed(4);
        await qr.query(
          `
          INSERT INTO public.stk_stock_actual (producto_id, almacen_id, cantidad)
          VALUES ($1, $2, $3)
          ON CONFLICT (producto_id, almacen_id)
          DO UPDATE SET cantidad = public.stk_stock_actual.cantidad + EXCLUDED.cantidad
        `,
          [productoId, almacenId, deltaStr],
        );
      };

      const actualizarLoteAlmacen = async (
        loteId: string,
        almacenId: number,
        deltaNegativo: number,
      ) => {
        const deltaStr = Number(deltaNegativo).toFixed(4);
        await qr.query(
          `
          UPDATE public.stk_lote_almacen
             SET cantidad_disponible = cantidad_disponible + $3
           WHERE lote_id = $1
             AND almacen_id = $2
        `,
          [loteId, almacenId, deltaStr],
        );
      };

      const actualizarLoteGlobal = async (
        loteId: string,
        deltaNegativo: number,
      ) => {
        const deltaStr = Number(deltaNegativo).toFixed(4);
        await qr.query(
          `
          UPDATE public.stk_lotes
             SET cantidad_disponible = cantidad_disponible + $2
           WHERE id = $1
        `,
          [loteId, deltaStr],
        );
      };

      // Procesar cada línea
      for (const linea of dto.lineas) {
        const pid = linea.producto_id;
        const alm = linea.almacen_id;
        let restante = Number(linea.cantidad);

        // 1) Caso: viene lote_id explícito → consumo solo de ese lote
        if (linea.lote_id) {
          const row = await qr.query(
            `
            SELECT la.cantidad_disponible
              FROM public.stk_lote_almacen la
              JOIN public.stk_lotes l ON l.id = la.lote_id
             WHERE la.almacen_id = $1
               AND la.lote_id = $2
               AND l.producto_id = $3
             FOR UPDATE
          `,
            [alm, linea.lote_id, pid],
          );

          if (!row.length) {
            throw new BadRequestException(
              `No se encontró lote ${linea.lote_id} para producto ${pid} en almacén ${alm}`,
            );
          }

          const disp = Number(row[0].cantidad_disponible);
          if (restante > disp + 1e-9) {
            throw new BadRequestException(
              `Stock insuficiente en lote ${linea.lote_id} (disp: ${disp}, pedido: ${restante})`,
            );
          }

          const toma = restante;
          const tomaStr = toma.toFixed(4);

          await actualizarLoteAlmacen(linea.lote_id, alm, -toma);
          await actualizarLoteGlobal(linea.lote_id, -toma);
          await actualizarStockActual(pid, alm, -toma);

          const det = qr.manager.create(MovimientoStockDetalle, {
            movimiento: mov,
            producto_id: pid,
            lote_id: linea.lote_id,
            cantidad: tomaStr,
            efecto: -1,
          });
          await qr.manager.save(det);

          detallesResumen.push({
            producto_id: pid,
            lote_id: linea.lote_id,
            cantidad: tomaStr,
            almacen_id: alm,
          });

          restante = 0;
        }

        // 2) FIFO por lote si no vino lote_id (o si quedó remanente por alguna futura regla)
        while (restante > 1e-9) {
          const rows = await qr.query(
            `
            SELECT la.lote_id,
                   la.cantidad_disponible,
                   l.fecha_remito,
                   l.created_at
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

          if (!rows.length) {
            throw new BadRequestException(
              `Stock insuficiente en almacén ${alm} para producto ${pid}`,
            );
          }

          const row = rows[0] as {
            lote_id: string;
            cantidad_disponible: string;
          };

          const disp = Number(row.cantidad_disponible);
          const toma = Math.min(restante, disp);
          const tomaStr = toma.toFixed(4);

          await actualizarLoteAlmacen(row.lote_id, alm, -toma);
          await actualizarLoteGlobal(row.lote_id, -toma);
          await actualizarStockActual(pid, alm, -toma);

          const det = qr.manager.create(MovimientoStockDetalle, {
            movimiento: mov,
            producto_id: pid,
            lote_id: row.lote_id,
            cantidad: tomaStr,
            efecto: -1,
          });
          await qr.manager.save(det);

          detallesResumen.push({
            producto_id: pid,
            lote_id: row.lote_id,
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
    } catch (e) {
      await qr.rollbackTransaction();
      console.error('[POST /stock/movimientos/venta] error:', e?.message || e);
      throw new BadRequestException(
        e?.detail || e?.message || 'Error registrando venta de stock',
      );
    } finally {
      await qr.release();
    }
  }
}

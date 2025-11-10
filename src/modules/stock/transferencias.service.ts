import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransferenciaDto } from './dto/transferencia.dto';
import { MovimientoStock } from './entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from './entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from './enums/movimiento-tipo.enum';

@Injectable()
export class TransferenciasService {
  constructor(private readonly ds: DataSource) {}

  async transferir(dto: TransferenciaDto) {
    if (!dto.lineas?.length) {
      throw new BadRequestException(
        'La transferencia debe tener al menos una línea',
      );
    }

    // Validaciones por línea
    dto.lineas.forEach((l, idx) => {
      if (l.almacen_origen_id === l.almacen_destino_id) {
        throw new BadRequestException(
          `En la línea ${idx + 1} el almacén origen y destino deben ser distintos`,
        );
      }
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

      // Cabecera de movimiento (sin almacén fijo porque puede haber varios)
      const mov = await qr.manager.save(
        qr.manager.create(MovimientoStock, {
          tipo: MovimientoTipo.TRANSFERENCIA,
          fecha,
          almacen_origen_id: null,
          almacen_destino_id: null,
          referencia_tipo: 'TRANSFERENCIA_INT',
          referencia_id: dto.referencia ?? null,
          observacion: dto.observacion ?? null,
        }),
      );

      const detallesResumen: Array<{
        producto_id: number;
        lote_id: string;
        cantidad: string;
        almacen_origen_id: number;
        almacen_destino_id: number;
      }> = [];

      // Helpers SQL
      const upsertStockActual = async (
        productoId: number,
        almacenId: number,
        delta: number,
      ) => {
        const deltaStr = Number(delta).toFixed(4);
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

      const addToLoteAlmacenDisponible = async (
        loteId: string,
        almacenId: number,
        delta: number,
      ) => {
        const deltaStr = Number(delta).toFixed(4);
        await qr.query(
          `
          INSERT INTO public.stk_lote_almacen (lote_id, almacen_id, cantidad_asignada, cantidad_disponible)
          VALUES ($1, $2, 0, $3)
          ON CONFLICT (lote_id, almacen_id)
          DO UPDATE SET cantidad_disponible = public.stk_lote_almacen.cantidad_disponible + EXCLUDED.cantidad_disponible
        `,
          [loteId, almacenId, deltaStr],
        );
      };

      // Procesar cada línea
      for (const linea of dto.lineas) {
        const pid = linea.producto_id;
        let restante = Number(linea.cantidad);

        // FIFO por lote del ALMACÉN ORIGEN
        while (restante > 1e-9) {
          const rows = await qr.query(
            `
            SELECT la.id as la_id, la.lote_id, la.cantidad_disponible
            FROM public.stk_lote_almacen la
            JOIN public.stk_lotes l ON l.id = la.lote_id
            WHERE la.almacen_id = $1
              AND l.producto_id = $2
              AND la.cantidad_disponible > 0
            ORDER BY l.fecha_remito ASC, l.created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          `,
            [linea.almacen_origen_id, pid],
          );

          if (!rows.length) {
            throw new BadRequestException(
              `Stock insuficiente en almacén origen ${linea.almacen_origen_id} para producto ${pid}`,
            );
          }

          const row = rows[0] as {
            lote_id: string;
            cantidad_disponible: string;
          };

          const disp = Number(row.cantidad_disponible);
          const toma = Math.min(restante, disp);
          const tomaStr = toma.toFixed(4);

          // Mover disponibilidad entre almacenes
          await addToLoteAlmacenDisponible(
            row.lote_id,
            linea.almacen_origen_id,
            -toma,
          );
          await addToLoteAlmacenDisponible(
            row.lote_id,
            linea.almacen_destino_id,
            toma,
          );

          // Actualizar stock_actual
          await upsertStockActual(pid, linea.almacen_origen_id, -toma);
          await upsertStockActual(pid, linea.almacen_destino_id, toma);

          // Detalle SALIDA (origen)
          const detSalida = qr.manager.create(MovimientoStockDetalle, {
            movimiento: mov,
            producto_id: pid,
            lote_id: row.lote_id,
            cantidad: tomaStr,
            efecto: -1,
          });
          await qr.manager.save(detSalida);

          // Detalle ENTRADA (destino)
          const detEntrada = qr.manager.create(MovimientoStockDetalle, {
            movimiento: mov,
            producto_id: pid,
            lote_id: row.lote_id,
            cantidad: tomaStr,
            efecto: 1,
          });
          await qr.manager.save(detEntrada);

          detallesResumen.push({
            producto_id: pid,
            lote_id: row.lote_id,
            cantidad: tomaStr,
            almacen_origen_id: linea.almacen_origen_id,
            almacen_destino_id: linea.almacen_destino_id,
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
}

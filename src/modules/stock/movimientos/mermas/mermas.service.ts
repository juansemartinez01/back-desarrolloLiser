// src/modules/stock/movimientos/mermas/mermas.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RegistrarMermaDto } from './dto/registrar-merma.dto';
import { MovimientoStock } from '../entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from '../entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from '../../enums/movimiento-tipo.enum';

@Injectable()
export class MermasService {
  constructor(private readonly ds: DataSource) {}

  private toDec4(n: number) {
    return Number(n).toFixed(4);
  }

  async registrarMerma(dto: RegistrarMermaDto) {
    if (!dto.lineas?.length) {
      throw new BadRequestException('La merma debe tener al menos una línea');
    }

    // Validaciones mínimas
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

      // Cabecera del movimiento
      const mov = await qr.manager.save(
        qr.manager.create(MovimientoStock, {
          tipo: MovimientoTipo.MERMA,
          fecha,
          almacen_origen_id: null, // merma lógica: el origen se infiere por línea
          almacen_destino_id: null,
          referencia_tipo: 'MERMA',
          referencia_id: dto.referencia ?? null,
          observacion: dto.observacion ?? null,
        }),
      );

      // Helpers
      const upsertStockActual = async (
        productoId: number,
        almacenId: number,
        deltaNegativo: number, // siempre negativo en merma
      ) => {
        const deltaStr = this.toDec4(deltaNegativo);
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

      const descontarEnLoteAlmacen = async (
        loteId: string,
        almacenId: number,
        cantidad: number,
      ) => {
        const cantidadStr = this.toDec4(cantidad);
        // global
        await qr.query(
          `
          UPDATE public.stk_lotes
          SET cantidad_disponible = cantidad_disponible - $2
          WHERE id = $1
        `,
          [loteId, cantidadStr],
        );
        // por almacén
        await qr.query(
          `
          UPDATE public.stk_lote_almacen
          SET cantidad_disponible = cantidad_disponible - $2
          WHERE lote_id = $1 AND almacen_id = $3
        `,
          [loteId, cantidadStr, almacenId],
        );
      };

      const detallesResumen: Array<{
        producto_id: number;
        lote_id: string;
        cantidad: string;
        tipo: 'SALIDA';
        almacen_id: number;
      }> = [];

      for (const linea of dto.lineas) {
        const pid = linea.producto_id;
        const aid = linea.almacen_id;
        let restante = Number(linea.cantidad);

        if (linea.lote_id) {
          // --- Modo lote específico: verifico y descuento ---
          // Lock global del lote
          const lotes = await qr.query(
            `
            SELECT id, producto_id, cantidad_disponible
            FROM public.stk_lotes
            WHERE id = $1
            FOR UPDATE
          `,
            [linea.lote_id],
          );
          if (!lotes.length) {
            throw new BadRequestException(
              `Lote ${linea.lote_id} no encontrado`,
            );
          }
          const lote = lotes[0] as {
            id: string;
            producto_id: number;
            cantidad_disponible: string;
          };
          if (lote.producto_id !== pid) {
            throw new BadRequestException(
              `El lote ${linea.lote_id} no corresponde al producto_id=${pid}`,
            );
          }

          // Lock de la fila del almacén
          const laRows = await qr.query(
            `
            SELECT id, cantidad_disponible
            FROM public.stk_lote_almacen
            WHERE lote_id = $1 AND almacen_id = $2
            FOR UPDATE
          `,
            [linea.lote_id, aid],
          );
          if (!laRows.length) {
            throw new BadRequestException(
              `El lote ${linea.lote_id} no tiene stock en el almacén ${aid}`,
            );
          }
          const la = laRows[0] as { id: string; cantidad_disponible: string };

          const dispGlobal = Number(lote.cantidad_disponible);
          const dispAlmacen = Number(la.cantidad_disponible);
          if (dispGlobal + 1e-9 < restante) {
            throw new BadRequestException(
              `Stock insuficiente en lote (global). Disponible=${dispGlobal}, requerido=${restante}`,
            );
          }
          if (dispAlmacen + 1e-9 < restante) {
            throw new BadRequestException(
              `Stock insuficiente en almacén ${aid} para ese lote. Disponible=${dispAlmacen}, requerido=${restante}`,
            );
          }

          await descontarEnLoteAlmacen(linea.lote_id, aid, restante);
          await upsertStockActual(pid, aid, -restante);

          const cantStr = this.toDec4(restante);

          const detSalida = qr.manager.create(MovimientoStockDetalle, {
            movimiento: mov,
            producto_id: pid,
            lote_id: linea.lote_id,
            cantidad: cantStr,
            efecto: -1,
          });
          await qr.manager.save(detSalida);

          detallesResumen.push({
            producto_id: pid,
            lote_id: linea.lote_id,
            cantidad: cantStr,
            tipo: 'SALIDA',
            almacen_id: aid,
          });

          restante = 0;
        } else {
          // --- Modo FIFO por producto/almacén ---
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
              [aid, pid],
            );

            if (!rows.length) {
              throw new BadRequestException(
                `Stock insuficiente en almacén ${aid} para producto ${pid}`,
              );
            }

            const row = rows[0] as {
              lote_id: string;
              cantidad_disponible: string;
            };

            const disp = Number(row.cantidad_disponible);
            const toma = Math.min(restante, disp);

            await descontarEnLoteAlmacen(row.lote_id, aid, toma);
            await upsertStockActual(pid, aid, -toma);

            const tomaStr = this.toDec4(toma);
            const detSalida = qr.manager.create(MovimientoStockDetalle, {
              movimiento: mov,
              producto_id: pid,
              lote_id: row.lote_id,
              cantidad: tomaStr,
              efecto: -1,
            });
            await qr.manager.save(detSalida);

            detallesResumen.push({
              producto_id: pid,
              lote_id: row.lote_id,
              cantidad: tomaStr,
              tipo: 'SALIDA',
              almacen_id: aid,
            });

            restante = Number((restante - toma).toFixed(4));
          }
        }
      }

      await qr.commitTransaction();

      return {
        ok: true,
        movimiento_id: mov.id,
        referencia: mov.referencia_id,
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

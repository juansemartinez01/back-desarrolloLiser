import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConteoAjusteDto } from './dto/conteo-ajuste.dto';
import { MovimientoStock } from '../movimientos/entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from '../movimientos/entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from '../enums/movimiento-tipo.enum';

function toDecimal4(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(4);
}

async function calcularDiaSiguienteAR(qr: any, fecha: Date): Promise<string> {
  const rows = await qr.query(
    `
    SELECT
      ((($1::timestamptz AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) + 1)::date AS dia
    `,
    [fecha.toISOString()],
  );
  return rows[0].dia; // 'YYYY-MM-DD'
}


@Injectable()
export class ConteosService {
  constructor(private readonly ds: DataSource) {}


  
  async ajustarPorConteo(dto: ConteoAjusteDto) {
    if (!dto.lineas?.length) {
      throw new BadRequestException(
        'El conteo debe incluir al menos una línea',
      );
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

      const diaOperativoRows = await qr.query(
            `
      SELECT
        ((($1::timestamptz AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) + 1)::date AS dia
      `,
            [fecha.toISOString()],
          );

          const diaOperativo = diaOperativoRows[0].dia; // 'YYYY-MM-DD'

      // Cabecera única para todo el conteo
      const mov = await qr.manager.save(
        qr.manager.create(MovimientoStock, {
          tipo: MovimientoTipo.AJUSTE,
          fecha,
          almacen_origen_id: null,
          almacen_destino_id: null,
          referencia_tipo: 'CONTEO',
          referencia_id: 'CONTEO-' + Date.now(),
          observacion: dto.observacion ?? null,
        }),
      );

      // Helper para stock_actual (delta puede ser + o -)
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

      const upsertStockInicialDiario = async (
        dia: string,
        productoId: number,
        almacenId: number,
        cantidadInicial: number,
        movimientoId: string,
      ) => {
        await qr.query(
          `
        INSERT INTO public.stk_stock_inicial_diario
          (dia, producto_id, almacen_id, cantidad_inicial, movimiento_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (dia, producto_id, almacen_id)
        DO UPDATE SET
          cantidad_inicial = EXCLUDED.cantidad_inicial,
          movimiento_id    = EXCLUDED.movimiento_id
        `,
              [
                dia,
                productoId,
                almacenId,
                toDecimal4(cantidadInicial),
                movimientoId,
              ],
            );
          };


      const ajustesResumen: Array<{
        producto_id: number;
        almacen_id: number;
        cantidad_anterior: string;
        cantidad_contada: string;
        delta: string;
      }> = [];

      for (const linea of dto.lineas) {
        const pid = linea.producto_id;
        const aid = linea.almacen_id;
        const contado = Number(linea.cantidad_contada);

        if (contado < 0) {
          throw new BadRequestException(
            `cantidad_contada debe ser >= 0 (producto ${pid}, almacén ${aid})`,
          );
        }

        // Stock actual por producto+almacén
        const currentRow = await qr.query(
          `
          SELECT cantidad
          FROM public.stk_stock_actual
          WHERE producto_id = $1 AND almacen_id = $2
          FOR UPDATE
        `,
          [pid, aid],
        );

        const actual = currentRow.length ? Number(currentRow[0].cantidad) : 0;

        const delta = Number((contado - actual).toFixed(4));
        if (Math.abs(delta) < 1e-9) {
          // Nada que ajustar
          ajustesResumen.push({
            producto_id: pid,
            almacen_id: aid,
            cantidad_anterior: toDecimal4(actual),
            cantidad_contada: toDecimal4(contado),
            delta: toDecimal4(0),
          });

          await upsertStockInicialDiario(
            diaOperativo,
            pid,
            aid,
            contado,
            mov.id,
          );


          continue;
        }

        if (delta < 0) {
          // Hay menos físico que en sistema -> hay que sacar stock (salidas)
          let porBajar = -delta; // positivo

          // Lotes en ese almacén con disponibilidad > 0, FIFO
          const lotes = await qr.query(
            `
            SELECT
              l.id            AS lote_id,
              l.cantidad_disponible::numeric AS lote_disp,
              la.id           AS la_id,
              la.cantidad_disponible::numeric AS la_disp
            FROM public.stk_lotes l
            JOIN public.stk_lote_almacen la ON la.lote_id = l.id
            WHERE la.almacen_id = $1
              AND l.producto_id = $2
              AND la.cantidad_disponible > 0
            ORDER BY l.fecha_remito ASC, l.created_at ASC
            FOR UPDATE
          `,
            [aid, pid],
          );

          const totalDispAlm = lotes.reduce(
            (s: number, r: any) => s + Number(r.la_disp),
            0,
          );

          if (totalDispAlm + 1e-9 < porBajar) {
            throw new BadRequestException(
              `No hay detalle de lotes suficiente en almacén ${aid} para bajar ${porBajar} de producto ${pid} (disp_detalle=${totalDispAlm}, delta=${porBajar})`,
            );
          }

          for (const r of lotes) {
            if (porBajar <= 1e-9) break;

            const loteId = r.lote_id as string;
            const laId = r.la_id as string;
            const loteDisp = Number(r.lote_disp);
            const laDisp = Number(r.la_disp);

            if (laDisp <= 0) continue;

            const toma = Math.min(porBajar, laDisp);
            const tomaStr = toma.toFixed(4);

            // Bajar del lote (global)
            await qr.query(
              `
              UPDATE public.stk_lotes
              SET cantidad_disponible = cantidad_disponible - $2
              WHERE id = $1
            `,
              [loteId, tomaStr],
            );

            // Bajar del lote_almacen
            await qr.query(
              `
              UPDATE public.stk_lote_almacen
              SET cantidad_disponible = cantidad_disponible - $2
              WHERE id = $1
            `,
              [laId, tomaStr],
            );

            // Detalle de salida
            const det = qr.manager.create(MovimientoStockDetalle, {
              movimiento: mov,
              producto_id: pid,
              lote_id: loteId,
              cantidad: tomaStr,
              efecto: -1,
            });
            await qr.manager.save(det);

            porBajar = Number((porBajar - toma).toFixed(4));
          }

          // Ajustar stock_actual (baja)
          await upsertStockActual(pid, aid, delta); // delta es negativo
        } else {
          // delta > 0: Hay más físico que en sistema -> hay que agregar stock (entradas)
          let porSubir = delta;

          // Buscar lote del producto en ese almacén; si hay varios, tomamos el más reciente
          const lotes = await qr.query(
            `
            SELECT
              l.id            AS lote_id,
              la.id           AS la_id,
              la.cantidad_disponible::numeric AS la_disp
            FROM public.stk_lotes l
            JOIN public.stk_lote_almacen la ON la.lote_id = l.id
            WHERE la.almacen_id = $1
              AND l.producto_id = $2
            ORDER BY l.fecha_remito DESC, l.created_at DESC
            FOR UPDATE
            LIMIT 1
          `,
            [aid, pid],
          );

          if (!lotes.length) {
            throw new BadRequestException(
              `No existen lotes en almacén ${aid} para producto ${pid}. No puedo incrementar stock; por favor registre el remito correspondiente o un ajuste de ingreso específico.`,
            );
          }

          const r = lotes[0];
          const loteId = r.lote_id as string;
          const laId = r.la_id as string;
          const sumStr = porSubir.toFixed(4);

          // Subir lote global
          await qr.query(
            `
            UPDATE public.stk_lotes
            SET cantidad_disponible = cantidad_disponible + $2
            WHERE id = $1
          `,
            [loteId, sumStr],
          );

          // Subir lote_almacen
          await qr.query(
            `
            UPDATE public.stk_lote_almacen
            SET cantidad_disponible = cantidad_disponible + $2
            WHERE id = $1
          `,
            [laId, sumStr],
          );

          // Detalle de entrada
          const det = qr.manager.create(MovimientoStockDetalle, {
            movimiento: mov,
            producto_id: pid,
            lote_id: loteId,
            cantidad: sumStr,
            efecto: 1,
          });
          await qr.manager.save(det);

          // Ajustar stock_actual (alta)
          await upsertStockActual(pid, aid, delta);
        }

        await upsertStockInicialDiario(diaOperativo, pid, aid, contado, mov.id);

        ajustesResumen.push({
          producto_id: pid,
          almacen_id: aid,
          cantidad_anterior: toDecimal4(actual),
          cantidad_contada: toDecimal4(contado),
          delta: toDecimal4(delta),
        });
      }

      await qr.commitTransaction();

      return {
        ok: true,
        movimiento_id: mov.id,
        referencia: mov.referencia_id,
        ajustes: ajustesResumen,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  
}

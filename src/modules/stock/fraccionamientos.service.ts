import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FraccionamientoDto } from './dto/fraccionamiento.dto';
import { MovimientoStock } from './entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from './entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from './enums/movimiento-tipo.enum';
import { FraccionamientoFactorDto } from './dto/fraccionamiento-factor.dto';

@Injectable()
export class FraccionamientosService {
  constructor(private readonly ds: DataSource) {}

  async fraccionar(dto: FraccionamientoDto) {
    if (!dto.lineas?.length) {
      throw new BadRequestException(
        'El fraccionamiento debe tener al menos una línea',
      );
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

      // Cabecera de movimiento
      const mov = await qr.manager.save(
        qr.manager.create(MovimientoStock, {
          tipo: MovimientoTipo.AJUSTE,
          fecha,
          almacen_origen_id: null,
          almacen_destino_id: null,
          referencia_tipo: 'FRACCION',
          referencia_id: 'FRACC-' + Date.now(),
          observacion: dto.observacion ?? null,
        }),
      );

      const detallesResumen: Array<{
        producto_id: number;
        lote_id: string;
        cantidad: string;
        tipo: 'SALIDA' | 'ENTRADA';
      }> = [];

      // Helpers
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

      for (const linea of dto.lineas) {
        if (!linea.salidas?.length) {
          throw new BadRequestException(
            `La línea con lote_origen_id=${linea.lote_origen_id} no tiene salidas`,
          );
        }

        const totalSalidas = linea.salidas.reduce(
          (s, x) => s + Number(x.cantidad),
          0,
        );

        if (!(totalSalidas > 0)) {
          throw new BadRequestException(
            `La suma de salidas debe ser > 0 para el lote ${linea.lote_origen_id}`,
          );
        }

        // Lock del lote origen
        const lotes = await qr.query(
          `
          SELECT id, remito_item_id, producto_id, fecha_remito, cantidad_disponible
          FROM public.stk_lotes
          WHERE id = $1
          FOR UPDATE
        `,
          [linea.lote_origen_id],
        );

        if (!lotes.length) {
          throw new BadRequestException(
            `Lote origen ${linea.lote_origen_id} no encontrado`,
          );
        }

        const loteOrigen = lotes[0] as {
          id: string;
          remito_item_id: string;
          producto_id: number;
          fecha_remito: string;
          cantidad_disponible: string;
        };

        if (loteOrigen.producto_id !== linea.producto_origen_id) {
          throw new BadRequestException(
            `El lote ${linea.lote_origen_id} no corresponde al producto_origen_id=${linea.producto_origen_id}`,
          );
        }

        const dispGlobal = Number(loteOrigen.cantidad_disponible);
        if (dispGlobal + 1e-9 < totalSalidas) {
          throw new BadRequestException(
            `Cantidad insuficiente en lote origen (global). Disponible=${dispGlobal}, requerido=${totalSalidas}`,
          );
        }

        // Lock de la fila lote_almacen de ese almacén
        const laRows = await qr.query(
          `
          SELECT id, cantidad_disponible
          FROM public.stk_lote_almacen
          WHERE lote_id = $1 AND almacen_id = $2
          FOR UPDATE
        `,
          [linea.lote_origen_id, linea.almacen_id],
        );

        if (!laRows.length) {
          throw new BadRequestException(
            `El lote ${linea.lote_origen_id} no tiene stock en el almacén ${linea.almacen_id}`,
          );
        }

        const laOrigen = laRows[0] as {
          id: string;
          cantidad_disponible: string;
        };

        const dispAlm = Number(laOrigen.cantidad_disponible);
        if (dispAlm + 1e-9 < totalSalidas) {
          throw new BadRequestException(
            `Cantidad insuficiente en almacén ${linea.almacen_id} para el lote ${linea.lote_origen_id}. Disponible=${dispAlm}, requerido=${totalSalidas}`,
          );
        }

        // Descontar del lote (global) y del lote_almacen
        const totalStr = totalSalidas.toFixed(4);

        await qr.query(
          `
          UPDATE public.stk_lotes
          SET cantidad_disponible = cantidad_disponible - $2
          WHERE id = $1
        `,
          [linea.lote_origen_id, totalStr],
        );

        await qr.query(
          `
          UPDATE public.stk_lote_almacen
          SET cantidad_disponible = cantidad_disponible - $2
          WHERE id = $1
        `,
          [laOrigen.id, totalStr],
        );

        // Actualizar stock_actual del producto origen (baja)
        await upsertStockActual(
          linea.producto_origen_id,
          linea.almacen_id,
          -totalSalidas,
        );

        // Detalle SALIDA (producto origen)
        const detSalida = qr.manager.create(MovimientoStockDetalle, {
          movimiento: mov,
          producto_id: linea.producto_origen_id,
          lote_id: linea.lote_origen_id,
          cantidad: totalStr,
          efecto: -1,
        });
        await qr.manager.save(detSalida);

        detallesResumen.push({
          producto_id: linea.producto_origen_id,
          lote_id: linea.lote_origen_id,
          cantidad: totalStr,
          tipo: 'SALIDA',
        });

        // Crear lotes destino + entradas
        for (const s of linea.salidas) {
          const cantidadDest = Number(s.cantidad);
          const cantidadDestStr = cantidadDest.toFixed(4);

          // Crear lote nuevo (mismo remito_item y fecha_remito para mantener la trazabilidad básica)
          const newLoteRows = await qr.query(
            `
            INSERT INTO public.stk_lotes
              (remito_item_id, producto_id, fecha_remito, lote_tipo, cantidad_inicial, cantidad_disponible)
            VALUES ($1, $2, $3, $4, $5, $5)
            RETURNING id
          `,
            [
              loteOrigen.remito_item_id,
              s.producto_destino_id,
              loteOrigen.fecha_remito,
              1, // o el tipo que uses por defecto
              cantidadDestStr,
            ],
          );

          const newLoteId: string = newLoteRows[0].id;

          // Crear registro en lote_almacen
          await addToLoteAlmacenDisponible(
            newLoteId,
            linea.almacen_id,
            cantidadDest,
          );

          // Actualizar stock_actual del producto destino (alta)
          await upsertStockActual(
            s.producto_destino_id,
            linea.almacen_id,
            cantidadDest,
          );

          // Detalle ENTRADA (producto destino)
          const detEntrada = qr.manager.create(MovimientoStockDetalle, {
            movimiento: mov,
            producto_id: s.producto_destino_id,
            lote_id: newLoteId,
            cantidad: cantidadDestStr,
            efecto: 1,
          });
          await qr.manager.save(detEntrada);

          detallesResumen.push({
            producto_id: s.producto_destino_id,
            lote_id: newLoteId,
            cantidad: cantidadDestStr,
            tipo: 'ENTRADA',
          });
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

  // 🔹 NUEVO: fraccionar multiplicando unidades
  async fraccionarConFactor(dto: FraccionamientoFactorDto) {
    if (!dto.lineas?.length) {
      throw new BadRequestException(
        'El fraccionamiento debe tener al menos una línea',
      );
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

      // Cabecera de movimiento
      const mov = await qr.manager.save(
        qr.manager.create(MovimientoStock, {
          tipo: MovimientoTipo.AJUSTE,
          fecha,
          almacen_origen_id: null,
          almacen_destino_id: null,
          referencia_tipo: 'FRACCION_FACTOR',
          referencia_id: 'FRF-' + Date.now(),
          observacion: dto.observacion ?? null,
        }),
      );

      const detallesResumen: Array<{
        producto_id: number;
        lote_id: string;
        cantidad: string;
        tipo: 'SALIDA' | 'ENTRADA';
      }> = [];

      // Helpers
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

      for (const linea of dto.lineas) {
        if (!(Number(linea.cantidad_origen) > 0)) {
          throw new BadRequestException(
            `La cantidad_origen debe ser > 0 para el lote ${linea.lote_origen_id}`,
          );
        }
        if (!(Number(linea.factor_unidades) > 0)) {
          throw new BadRequestException(
            `El factor_unidades debe ser > 0 para el lote ${linea.lote_origen_id}`,
          );
        }

        // 1) Lock del lote origen (global)
        const lotes = await qr.query(
          `
          SELECT id, remito_item_id, producto_id, fecha_remito, cantidad_disponible
          FROM public.stk_lotes
          WHERE id = $1
          FOR UPDATE
        `,
          [linea.lote_origen_id],
        );

        if (!lotes.length) {
          throw new BadRequestException(
            `Lote origen ${linea.lote_origen_id} no encontrado`,
          );
        }

        const loteOrigen = lotes[0] as {
          id: string;
          remito_item_id: string;
          producto_id: number;
          fecha_remito: string;
          cantidad_disponible: string;
        };

        if (loteOrigen.producto_id !== linea.producto_origen_id) {
          throw new BadRequestException(
            `El lote ${linea.lote_origen_id} no corresponde al producto_origen_id=${linea.producto_origen_id}`,
          );
        }

        const dispGlobal = Number(loteOrigen.cantidad_disponible);
        const cantOrigen = Number(linea.cantidad_origen);
        if (dispGlobal + 1e-9 < cantOrigen) {
          throw new BadRequestException(
            `Cantidad insuficiente en lote origen (global). Disponible=${dispGlobal}, requerido=${cantOrigen}`,
          );
        }

        // 2) Lock de lote_almacen del almacén
        const laRows = await qr.query(
          `
          SELECT id, cantidad_disponible
          FROM public.stk_lote_almacen
          WHERE lote_id = $1 AND almacen_id = $2
          FOR UPDATE
        `,
          [linea.lote_origen_id, linea.almacen_id],
        );

        if (!laRows.length) {
          throw new BadRequestException(
            `El lote ${linea.lote_origen_id} no tiene stock en el almacén ${linea.almacen_id}`,
          );
        }

        const laOrigen = laRows[0] as {
          id: string;
          cantidad_disponible: string;
        };

        const dispAlm = Number(laOrigen.cantidad_disponible);
        if (dispAlm + 1e-9 < cantOrigen) {
          throw new BadRequestException(
            `Cantidad insuficiente en almacén ${linea.almacen_id} para el lote ${linea.lote_origen_id}. Disponible=${dispAlm}, requerido=${cantOrigen}`,
          );
        }

        const cantOrigenStr = cantOrigen.toFixed(4);

        // 3) Descontar del lote global y del lote_almacen
        await qr.query(
          `
          UPDATE public.stk_lotes
          SET cantidad_disponible = cantidad_disponible - $2
          WHERE id = $1
        `,
          [linea.lote_origen_id, cantOrigenStr],
        );

        await qr.query(
          `
          UPDATE public.stk_lote_almacen
          SET cantidad_disponible = cantidad_disponible - $2
          WHERE id = $1
        `,
          [laOrigen.id, cantOrigenStr],
        );

        // 4) Stock_actual producto origen
        await upsertStockActual(
          linea.producto_origen_id,
          linea.almacen_id,
          -cantOrigen,
        );

        // 5) Detalle SALIDA
        const detSalida = qr.manager.create(MovimientoStockDetalle, {
          movimiento: mov,
          producto_id: linea.producto_origen_id,
          lote_id: linea.lote_origen_id,
          cantidad: cantOrigenStr,
          efecto: -1,
        });
        await qr.manager.save(detSalida);

        detallesResumen.push({
          producto_id: linea.producto_origen_id,
          lote_id: linea.lote_origen_id,
          cantidad: cantOrigenStr,
          tipo: 'SALIDA',
        });

        // 6) Calcular cantidad destino = origen * factor
        const cantidadDestino = cantOrigen * Number(linea.factor_unidades);
        const cantidadDestinoStr = cantidadDestino.toFixed(4);

        // 7) Crear lote destino
        const newLoteRows = await qr.query(
          `
          INSERT INTO public.stk_lotes
            (remito_item_id, producto_id, fecha_remito, lote_tipo, cantidad_inicial, cantidad_disponible)
          VALUES ($1, $2, $3, $4, $5, $5)
          RETURNING id
        `,
          [
            loteOrigen.remito_item_id,
            linea.producto_destino_id,
            loteOrigen.fecha_remito,
            1,
            cantidadDestinoStr,
          ],
        );

        const newLoteId: string = newLoteRows[0].id;

        // 8) Lote_almacen destino
        await addToLoteAlmacenDisponible(
          newLoteId,
          linea.almacen_id,
          cantidadDestino,
        );

        // 9) Stock_actual destino
        await upsertStockActual(
          linea.producto_destino_id,
          linea.almacen_id,
          cantidadDestino,
        );

        // 10) Detalle ENTRADA
        const detEntrada = qr.manager.create(MovimientoStockDetalle, {
          movimiento: mov,
          producto_id: linea.producto_destino_id,
          lote_id: newLoteId,
          cantidad: cantidadDestinoStr,
          efecto: 1,
        });
        await qr.manager.save(detEntrada);

        detallesResumen.push({
          producto_id: linea.producto_destino_id,
          lote_id: newLoteId,
          cantidad: cantidadDestinoStr,
          tipo: 'ENTRADA',
        });
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

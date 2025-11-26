import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MovimientoStock } from '../../movimientos/entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from '../../movimientos/entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from '../../enums/movimiento-tipo.enum';
import { EncontradoDto } from './dto/encontrado.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class EncontradosService {
  constructor(private readonly ds: DataSource) {}

  async registrarEncontrado(dto: EncontradoDto) {
    if (!dto.lineas?.length) {
      throw new BadRequestException('Debe enviar al menos una línea');
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

      const mov = await qr.manager.save(
        qr.manager.create(MovimientoStock, {
          tipo: MovimientoTipo.ENCONTRADO,
          fecha,
          almacen_origen_id: null,
          almacen_destino_id: null,
          referencia_tipo: 'ENCONTRADO',
          referencia_id: 'ENCON-' + Date.now(),
          observacion: dto.observacion ?? null,
        }),
      );

      // Helpers
      const updateStockActual = async (
        productoId: number,
        almacenId: number,
        qty: number,
      ) => {
        await qr.query(
          `
          INSERT INTO public.stk_stock_actual (producto_id, almacen_id, cantidad)
          VALUES ($1, $2, $3)
          ON CONFLICT(producto_id, almacen_id)
          DO UPDATE SET cantidad = stk_stock_actual.cantidad + EXCLUDED.cantidad
        `,
          [productoId, almacenId, qty.toFixed(4)],
        );
      };

      const sumToLote = async (loteId: string, cantidad: number) => {
        await qr.query(
          `
          UPDATE public.stk_lotes
          SET cantidad_disponible = cantidad_disponible + $2
          WHERE id = $1
        `,
          [loteId, cantidad.toFixed(4)],
        );
      };

      const sumToLoteAlmacen = async (
        loteId: string,
        almacenId: number,
        cantidad: number,
      ) => {
        await qr.query(
          `
          INSERT INTO public.stk_lote_almacen (lote_id, almacen_id, cantidad_asignada, cantidad_disponible)
          VALUES ($1, $2, 0, $3)
          ON CONFLICT (lote_id, almacen_id)
          DO UPDATE SET cantidad_disponible =
            stk_lote_almacen.cantidad_disponible + EXCLUDED.cantidad_disponible
        `,
          [loteId, almacenId, cantidad.toFixed(4)],
        );
      };

      for (const linea of dto.lineas) {
        const pid = linea.producto_id;
        const aid = linea.almacen_id;
        const cantidad = Number(linea.cantidad);

        if (cantidad <= 0) throw new BadRequestException('Cantidad inválida');

        // Si no viene lote, generamos uno
        let loteId = linea.lote_id;

        if (!loteId) {
          loteId = randomUUID();
          await qr.query(
                    `
            INSERT INTO public.stk_lotes (
            id,
            producto_id,
            cantidad_inicial,
            cantidad_disponible,
            fecha_remito,
            lote_tipo
            )
            VALUES ($1, $2, $3, $3, NOW(),2)
            `,
            [loteId, pid, cantidad.toFixed(4)],
          );
        } else {
          await sumToLote(loteId, cantidad);
        }


        // sumar a lote_almacen
        await sumToLoteAlmacen(loteId, aid, cantidad);

        // sumar stock_actual
        await updateStockActual(pid, aid, cantidad);

        // detalle del movimiento
        const det = qr.manager.create(MovimientoStockDetalle, {
          movimiento: mov,
          producto_id: pid,
          lote_id: loteId,
          cantidad: cantidad.toFixed(4),
          efecto: 1,
        });

        await qr.manager.save(det);
      }

      await qr.commitTransaction();

      return {
        ok: true,
        movimiento_id: mov.id,
        referencia: mov.referencia_id,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}

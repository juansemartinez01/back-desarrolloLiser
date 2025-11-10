import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConsumoVentaDto } from './dto/consumo-venta.dto';
import { MovimientoStock } from './entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from './entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from './enums/movimiento-tipo.enum';
import { StockLote } from './entities/stock-lote.entity';
import { StockActual } from './entities/stock-actual.entity';
import { LoteAlmacen } from './entities/lote-almacen.entity';
import { ConsumoPendiente } from './entities/consumo-pendiente.entity';

function toDecimal4(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(4);
}
function sub(a: string, b: string | number): string {
  return (Number(a) - Number(b)).toFixed(4);
}
function add(a: string, b: string | number): string {
  return (Number(a) + Number(b)).toFixed(4);
}

/**
 * CONFIGURACIÓN DE ALMACENES PARA LA REGLA "PUESTO + GALPÓN"
 *
 * Ajustá estos IDs a los de tu base:
 * - CENTRAL_WAREHOUSE_ID: id del almacén Galpón
 * - SALES_WAREHOUSES_USING_CENTRAL: ids de puestos que pueden vender usando stock del Galpón
 */
const CENTRAL_WAREHOUSE_ID = 1; // <-- poner aquí el id real del Galpón
const SALES_WAREHOUSES_USING_CENTRAL = new Set<number>([
  2, // Puesto 1
  3, // Puesto 2
  // agregar más si hace falta
]);

function getCentralWarehouseFor(almacenId?: number | null): number | null {
  if (!almacenId) return null;
  if (SALES_WAREHOUSES_USING_CENTRAL.has(almacenId)) {
    return CENTRAL_WAREHOUSE_ID;
  }
  return null;
}

@Injectable()
export class VentasService {
  constructor(private readonly ds: DataSource) {}

  async consumirVenta(dto: ConsumoVentaDto) {
    if (!dto.lineas?.length) {
      throw new BadRequestException('La venta debe tener al menos una línea');
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

      // Idempotencia rápida
      const existente = await qr.manager
        .getRepository(MovimientoStock)
        .findOne({
          where: {
            referencia_tipo: 'VENTA_DOC',
            referencia_id: dto.referencia_venta_id,
          },
          relations: { detalles: true },
        });
      if (existente) {
        const detalles = existente.detalles.map((d) => ({
          producto_id: d.producto_id,
          lote_id: d.lote_id,
          cantidad: d.cantidad,
        }));
        await qr.rollbackTransaction();
        await qr.release();
        return {
          ok: true,
          idempotente: true,
          movimiento_id: existente.id,
          detalles,
        };
      }

      /**
       * 1) VALIDACIÓN REGLA "PUESTO + GALPÓN"
       *
       * Para cada (producto, almacén) que sea un puesto controlado:
       *   - consultamos stock_actual local
       *   - consultamos stock_actual del Galpón
       *   - si cantidad_pedida > (local + galpón) => rechazamos venta
       */

      // Agrupar cantidad pedida por (producto_id, almacen_id)
      const consumoPorProdAlm = new Map<
        string,
        { producto_id: number; almacen_id: number; cantidad: number }
      >();

      for (const linea of dto.lineas) {
        if (!linea.almacen_id) continue; // sin almacén -> no aplicamos regla
        const key = `${linea.producto_id}|${linea.almacen_id}`;
        const prev = consumoPorProdAlm.get(key);
        const cant = Number(linea.cantidad);
        if (cant <= 0) {
          throw new BadRequestException('Cantidad de línea debe ser > 0');
        }
        if (prev) {
          prev.cantidad = Number((prev.cantidad + cant).toFixed(4));
        } else {
          consumoPorProdAlm.set(key, {
            producto_id: linea.producto_id,
            almacen_id: linea.almacen_id,
            cantidad: cant,
          });
        }
      }

      // Validar por cada (producto, almacén) controlado
      for (const {
        producto_id,
        almacen_id,
        cantidad,
      } of consumoPorProdAlm.values()) {
        const centralId = getCentralWarehouseFor(almacen_id);
        if (!centralId) {
          // almacenes que no usan la regla (ej: Quinta, Galpón mismo) siguen como antes
          continue;
        }

        // stock local del puesto
        const localRows = await qr.manager.query(
          `
          SELECT cantidad
          FROM public.stk_stock_actual
          WHERE producto_id = $1 AND almacen_id = $2
          `,
          [producto_id, almacen_id],
        );
        const localQty = localRows.length ? Number(localRows[0].cantidad) : 0;

        // stock en Galpón (almacén central)
        const centralRows = await qr.manager.query(
          `
          SELECT cantidad
          FROM public.stk_stock_actual
          WHERE producto_id = $1 AND almacen_id = $2
          `,
          [producto_id, centralId],
        );
        const centralQty = centralRows.length
          ? Number(centralRows[0].cantidad)
          : 0;

        let maxVendible = Number((localQty + centralQty).toFixed(4));
        if (maxVendible < 0) maxVendible = 0;

        if (cantidad > maxVendible + 1e-9) {
          throw new BadRequestException(
            `Stock insuficiente para producto ${producto_id} considerando almacén ${almacen_id} + almacén central ${centralId}. ` +
              `Disponible teórico: ${maxVendible.toFixed(4)}, Pedido: ${cantidad.toFixed(4)}`,
          );
        }
      }

      // 2) Cabecera de movimiento (si pasó la validación)
      const mov = await qr.manager.save(
        qr.manager.create(MovimientoStock, {
          tipo: MovimientoTipo.VENTA,
          fecha,
          // Sugerencia: si todas las líneas tienen el mismo almacen_id, podés setearlo aquí como origen.
          almacen_origen_id: null,
          almacen_destino_id: null,
          referencia_tipo: 'VENTA_DOC',
          referencia_id: dto.referencia_venta_id,
          observacion: dto.observacion ?? null,
        }),
      );

      const detallesResumen: Array<{
        producto_id: number;
        lote_id: string | null;
        cantidad: string;
      }> = [];

      // Helpers SQL (delta firmado)
      const upsertStockActual = async (
        productoId: number,
        almacenId: number,
        delta: number,
      ) => {
        const deltaStr = Number(delta).toFixed(4); // puede ser negativo
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
        const deltaStr = Number(delta).toFixed(4); // puede ser negativo
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

      // 3) Procesar líneas (FIFO global por lote, como antes)
      for (const linea of dto.lineas) {
        const pid = linea.producto_id;
        let restante = Number(linea.cantidad);
        if (!(restante > 0))
          throw new BadRequestException('Cantidad de línea debe ser > 0');

        // Mientras quede por vender, tomar el siguiente lote con disponibilidad (FIFO) y lockearlo
        while (restante > 1e-9) {
          const next = await qr.query(
            `
            SELECT id, cantidad_disponible
            FROM public.stk_lotes
            WHERE producto_id = $1
              AND cantidad_disponible > 0
              AND bloqueado = false
            ORDER BY fecha_remito ASC, created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
            `,
            [pid],
          );


          if (!next.length) break; // no hay más lotes disponibles

          const lote = next[0] as { id: string; cantidad_disponible: string };
          const disp = Number(lote.cantidad_disponible);
          const toma = Math.min(restante, disp);
          const tomaStr = toma.toFixed(4);

          // Descontar del lote (atómico)
          await qr.query(
            `
          UPDATE public.stk_lotes
          SET cantidad_disponible = (cantidad_disponible - $2)
          WHERE id = $1
          `,
            [lote.id, tomaStr],
          );

          // Registrar detalle (salida)
          const det = qr.manager.create(MovimientoStockDetalle, {
            movimiento: mov,
            producto_id: pid,
            lote_id: lote.id,
            cantidad: tomaStr,
            efecto: -1,
          });
          await qr.manager.save(det);

          // Si vino almacén, reflejar por almacén (puede quedar negativo)
          if (linea.almacen_id) {
            await addToLoteAlmacenDisponible(lote.id, linea.almacen_id, -toma);
            await upsertStockActual(pid, linea.almacen_id, -toma);
          }

          detallesResumen.push({
            producto_id: pid,
            lote_id: lote.id,
            cantidad: tomaStr,
          });
          restante = Number((restante - toma).toFixed(4));
        }

        // Si faltó stock físico (no quedaban lotes), registramos pendiente y (opcional) stock_actual negativo
        if (restante > 1e-9) {
          await qr.manager.save(
            qr.manager.create(ConsumoPendiente, {
              fecha,
              producto_id: pid,
              cantidad_pendiente: restante.toFixed(4),
              referencia_venta_id: dto.referencia_venta_id,
              precio_unitario:
                linea.precio_unitario != null
                  ? Number(linea.precio_unitario).toFixed(4)
                  : null,
              notas: dto.observacion ?? null,
            }),
          );

          if (linea.almacen_id) {
            await upsertStockActual(pid, linea.almacen_id, -restante);
          }
        }
      }

      await qr.commitTransaction();
      await qr.release();
      return {
        ok: true,
        movimiento_id: mov.id,
        referencia_venta_id: dto.referencia_venta_id,
        detalles: detallesResumen,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      await qr.release();
      throw err;
    }
  }
}

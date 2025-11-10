import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateRemitoDto } from './dto/create-remito.dto';
import { Remito } from './entities/remito.entity';
import { RemitoItem } from './entities/remito-item.entity';
import { StockLote } from './entities/stock-lote.entity';
import { LoteTipo } from './enums/lote-tipo.enum';
import { CreateDistribucionRemitoDto } from './dto/distribucion-remito.dto';
import { MovimientoStockDetalle } from './entities/movimiento-stock-detalle.entity';
import { StockActual } from './entities/stock-actual.entity';
import { LoteAlmacen } from './entities/lote-almacen.entity';
import { MovimientoStock } from './entities/movimiento-stock.entity';
import { MovimientoTipo } from './enums/movimiento-tipo.enum';
import { IngresoRapidoRemitoDto } from './dto/ingreso-rapido-remito.dto';

function toDecimal4(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(4);
}

function add(a: string, b: string | number): string {
  const av = Number(a);
  const bv = Number(b);
  return (av + bv).toFixed(4);
}
function sub(a: string, b: string | number): string {
  const av = Number(a);
  const bv = Number(b);
  return (av - bv).toFixed(4);
}

@Injectable()
export class RemitosService {
  constructor(private readonly ds: DataSource) {}

  async crearRemito(dto: CreateRemitoDto) {
    if (!dto.items?.length)
      throw new BadRequestException('El remito debe tener al menos un ítem');

    // Validaciones previas
    for (const it of dto.items) {
      const sum = Number(it.cantidad_tipo1) + Number(it.cantidad_tipo2);
      if (Number(toDecimal4(sum)) !== Number(toDecimal4(it.cantidad_total))) {
        throw new BadRequestException(
          `La suma tipo 1+ tipo 2 debe igualar cantidad_total para producto ${it.producto_id}`,
        );
      }
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const fecha = new Date(dto.fecha_remito);

      // Cabecera
      const remito = await qr.query(
        `INSERT INTO public.stk_remitos (fecha_remito, numero_remito, proveedor_id, proveedor_nombre, observaciones)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, fecha_remito, numero_remito, proveedor_id, proveedor_nombre, observaciones`,
        [
          fecha,
          dto.numero_remito,
          dto.proveedor_id ?? null,
          dto.proveedor_nombre ?? null,
          dto.observaciones ?? null,
        ],
      );
      const remitoId: string = remito[0].id;

      const itemsOut: any[] = [];

      // Items + lotes
      for (const it of dto.items) {
        const itemRow = await qr.query(
          `INSERT INTO public.stk_remito_items
            (remito_id, producto_id, unidad, cantidad_total, cantidad_tipo1, cantidad_tipo2, empresa_factura)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING id, producto_id, unidad, cantidad_total, cantidad_tipo1, cantidad_tipo2, empresa_factura`,
          [
            remitoId,
            it.producto_id,
            it.unidad ?? null,
            toDecimal4(it.cantidad_total),
            toDecimal4(it.cantidad_tipo1),
            toDecimal4(it.cantidad_tipo2),
            it.empresa_factura,
          ],
        );
        const remitoItemId: string = itemRow[0].id;

        const lotes: any[] = [];
        // TIPO_1
        await qr.query(
          `INSERT INTO public.stk_lotes
    (remito_item_id, producto_id, fecha_remito, lote_tipo, cantidad_inicial, cantidad_disponible)
   VALUES ($1,$2,$3,$4,$5,$5)
   RETURNING id, lote_tipo, cantidad_inicial, cantidad_disponible`,
          [
            remitoItemId,
            it.producto_id,
            fecha,
            1,
            toDecimal4(it.cantidad_tipo1),
          ],
        );

        // TIPO_2
        await qr.query(
          `INSERT INTO public.stk_lotes
    (remito_item_id, producto_id, fecha_remito, lote_tipo, cantidad_inicial, cantidad_disponible)
   VALUES ($1,$2,$3,$4,$5,$5)
   RETURNING id, lote_tipo, cantidad_inicial, cantidad_disponible`,
          [
            remitoItemId,
            it.producto_id,
            fecha,
            2,
            toDecimal4(it.cantidad_tipo2),
          ],
        );

        itemsOut.push({ ...itemRow[0], lotes });
      }

      await qr.commitTransaction();
      return { id: remitoId, ...remito[0], items: itemsOut };
    } catch (e: any) {
      await qr.rollbackTransaction();
      // log breve y error claro al cliente
      console.error(
        '[POST /stock/remitos] error:',
        e?.detail || e?.message || e,
      );
      throw new BadRequestException(
        e?.detail || e?.message || 'Error creando el remito',
      );
    } finally {
      await qr.release();
    }
  }

  async obtenerDetalle(id: string) {
    const r = await this.ds.query(
      `SELECT * FROM public.stk_remitos WHERE id = $1`,
      [id],
    );
    if (!r?.length) throw new NotFoundException('Remito no encontrado');

    const items = await this.ds.query(
      `SELECT * FROM public.stk_remito_items WHERE remito_id = $1 ORDER BY created_at ASC`,
      [id],
    );
    for (const it of items) {
      const lotes = await this.ds.query(
        `SELECT id, producto_id, lote_tipo, fecha_remito, cantidad_inicial, cantidad_disponible
         FROM public.stk_lotes WHERE remito_item_id = $1 ORDER BY lote_tipo ASC`,
        [it.id],
      );
      (it as any).lotes = lotes;
    }
    return { ...r[0], items };
  }

  async distribuirRemito(remitoId: string, dto: CreateDistribucionRemitoDto) {
    if (!dto.items?.length)
      throw new BadRequestException('Debe indicar items a distribuir');

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // 1) Remito + items + lotes
      const remito = await qr.manager.getRepository(Remito).findOne({
        where: { id: remitoId },
        relations: { items: { lotes: true } },
        order: {
          /* el order interno no es crítico */
        },
      });
      if (!remito) throw new NotFoundException('Remito no encontrado');

      const fechaMov = dto.fecha ? new Date(dto.fecha) : new Date();

      // 2) Índice de lotes (por producto) y cálculo de capacidad ASIGNABLE
      const lotsByProd = new Map<number, StockLote[]>();
      for (const it of remito.items) {
        const arr = lotsByProd.get(it.producto_id) ?? [];
        for (const l of it.lotes) arr.push(l);
        lotsByProd.set(it.producto_id, arr);
      }
      // FIFO determinista
      for (const [k, arr] of lotsByProd) {
        arr.sort(
          (a, b) =>
            new Date(a.fecha_remito).getTime() -
            new Date(b.fecha_remito).getTime(),
        );
      }

      // Pre-cargar asignado por lote para no consulta por consulta
      const lotesAll = Array.from(lotsByProd.values()).flat();
      const idLotes = lotesAll.map((l) => l.id);
      const asignadoPorLote = new Map<string, number>();
      if (idLotes.length) {
        const rows = await qr.query(
          `SELECT lote_id, COALESCE(SUM(cantidad_asignada),0)::numeric AS asignado
           FROM public.stk_lote_almacen
          WHERE lote_id = ANY($1::uuid[])
          GROUP BY lote_id`,
          [idLotes],
        );
        for (const r of rows)
          asignadoPorLote.set(r.lote_id, Number(r.asignado));
      }

      // Capacidad asignable por producto = sum(inicial) - sum(asignado)
      const capacidadProd = new Map<
        number,
        { total: number; asignado: number; remanente: number }
      >();
      for (const [pid, lots] of lotsByProd.entries()) {
        const total = lots.reduce((s, l) => s + Number(l.cantidad_inicial), 0);
        const asignado = lots.reduce(
          (s, l) => s + (asignadoPorLote.get(l.id) || 0),
          0,
        );
        capacidadProd.set(pid, {
          total,
          asignado,
          remanente: Number((total - asignado).toFixed(4)),
        });
      }

      // 3) Validación previa por producto contra remanente asignable
      const requeridoPorProd = new Map<number, number>();
      for (const it of dto.items) {
        const pedido = Number(
          it.distribuciones
            .reduce((a, d) => a + Number(d.cantidad), 0)
            .toFixed(4),
        );
        requeridoPorProd.set(
          it.producto_id,
          (requeridoPorProd.get(it.producto_id) || 0) + pedido,
        );
      }
      for (const [pid, req] of requeridoPorProd.entries()) {
        const cap = capacidadProd.get(pid);
        if (!cap)
          throw new BadRequestException(
            `El remito no contiene lotes para producto ${pid}`,
          );
        if (req > cap.remanente + 1e-9) {
          throw new BadRequestException(
            `Distribución excede remanente del remito para producto ${pid}. Pedido=${req}, Remanente=${cap.remanente}`,
          );
        }
      }

      // 4) Helper: movimiento por almacén
      const movByAlm = new Map<number, MovimientoStock>();
      const getMovimiento = async (almacenId: number) => {
        let mov = movByAlm.get(almacenId);
        if (!mov) {
          mov = qr.manager.create(MovimientoStock, {
            tipo: MovimientoTipo.INGRESO,
            fecha: fechaMov,
            almacen_origen_id: null,
            almacen_destino_id: almacenId,
            referencia_tipo: 'REM_DIS',
            referencia_id: remito.id,
            observacion: dto.observacion ?? null,
          });
          await qr.manager.save(mov);
          movByAlm.set(almacenId, mov);
        }
        return mov;
      };

      // Upsert stock_actual
      const upsertStockActual = async (
        productoId: number,
        almacenId: number,
        delta: number,
      ) => {
        const repo = qr.manager.getRepository(StockActual);
        let sa = await repo.findOne({
          where: { producto_id: productoId, almacen_id: almacenId },
        });
        if (!sa) {
          sa = repo.create({
            producto_id: productoId,
            almacen_id: almacenId,
            cantidad: toDecimal4(0),
          });
        }
        sa.cantidad = add(sa.cantidad as any, delta);
        await repo.save(sa);
      };

      // Upsert lote_almacen
      const upsertLoteAlmacen = async (
        loteId: string,
        almacenId: number,
        delta: number,
      ) => {
        const repo = qr.manager.getRepository(LoteAlmacen);

        // ✅ buscar por relación: lote: { id: ... }
        let la = await repo.findOne({
          where: { almacen_id: almacenId, lote: { id: loteId } },
        });

        if (!la) {
          la = repo.create({
            lote: { id: loteId } as any, // ✅ setear la RELACIÓN por id
            almacen_id: almacenId,
            cantidad_asignada: toDecimal4(0),
            cantidad_disponible: toDecimal4(0),
          });
        }

        la.cantidad_asignada = add(la.cantidad_asignada as any, delta);
        la.cantidad_disponible = add(la.cantidad_disponible as any, delta);

        await repo.save(la);
      };

      // Para FIFO: remanente por lote en memoria (inicial − asignado actual)
      const remanenteLote = new Map<string, number>();
      for (const l of lotesAll) {
        const asign = asignadoPorLote.get(l.id) || 0;
        remanenteLote.set(
          l.id,
          Number((Number(l.cantidad_inicial) - asign).toFixed(4)),
        );
      }

      // 5) Reparto
      for (const item of dto.items) {
        const lots = lotsByProd.get(item.producto_id) || [];
        const lotById = new Map<string, StockLote>(lots.map((l) => [l.id, l]));

        for (const d of item.distribuciones) {
          let restante = Number(d.cantidad);

          // (a) lote explícito
          if (d.lote_id) {
            const lote = lotById.get(d.lote_id);
            if (!lote)
              throw new BadRequestException(
                `Lote ${d.lote_id} no pertenece al remito o al producto ${item.producto_id}`,
              );

            const remLote = remanenteLote.get(lote.id) || 0;
            if (restante > remLote + 1e-9) {
              throw new BadRequestException(
                `Lote ${d.lote_id} sin remanente asignable suficiente (disp: ${remLote}, pedido: ${restante})`,
              );
            }

            const mov = await getMovimiento(d.almacen_id);
            const det = qr.manager.create(MovimientoStockDetalle, {
              movimiento: mov,
              producto_id: item.producto_id,
              lote_id: lote.id, // trazabilidad
              cantidad: toDecimal4(restante),
              efecto: 1,
            });
            await qr.manager.save(det);

            await upsertLoteAlmacen(lote.id, d.almacen_id, restante);
            await upsertStockActual(item.producto_id, d.almacen_id, restante);

            remanenteLote.set(lote.id, Number((remLote - restante).toFixed(4)));
            restante = 0;
          }

          // (b) FIFO entre lotes del remito (opcional prefer_tipo)
          while (restante > 1e-9) {
            let elegido: StockLote | undefined;
            if (d.prefer_tipo) {
              elegido = lots.find(
                (l) =>
                  l.lote_tipo === d.prefer_tipo &&
                  (remanenteLote.get(l.id) || 0) > 1e-9,
              );
            }
            if (!elegido) {
              elegido = lots.find((l) => (remanenteLote.get(l.id) || 0) > 1e-9);
            }
            if (!elegido) {
              throw new BadRequestException(
                `No hay remanente asignable suficiente para producto ${item.producto_id}`,
              );
            }

            const remLote = remanenteLote.get(elegido.id) || 0;
            const toma = Math.min(restante, remLote);

            const mov = await getMovimiento(d.almacen_id);
            const det = qr.manager.create(MovimientoStockDetalle, {
              movimiento: mov,
              producto_id: item.producto_id,
              lote_id: elegido.id, // trazabilidad
              cantidad: toDecimal4(toma),
              efecto: 1,
            });
            await qr.manager.save(det);

            await upsertLoteAlmacen(elegido.id, d.almacen_id, toma);
            await upsertStockActual(item.producto_id, d.almacen_id, toma);

            remanenteLote.set(elegido.id, Number((remLote - toma).toFixed(4)));
            restante = Number((restante - toma).toFixed(4));
          }
        }
      }

      await qr.commitTransaction();

      const movimientos = Array.from(movByAlm.values()).map((m) => ({
        id: m.id,
        almacen_destino_id: m.almacen_destino_id,
        fecha: m.fecha,
      }));
      return { ok: true, remito_id: remito.id, movimientos };
    } catch (e: any) {
      await qr.rollbackTransaction();
      console.error(
        '[POST /stock/remitos/:id/distribucion] error:',
        e?.detail || e?.message || e,
      );
      // devolver 400 con mensaje claro para no caer en 500 genérico
      throw new BadRequestException(
        e?.detail || e?.message || 'Error distribuyendo el remito',
      );
    } finally {
      await qr.release();
    }
  }

  async crearRemitoIngresoRapido(dto: IngresoRapidoRemitoDto) {
    if (!dto.items?.length) {
      throw new BadRequestException(
        'El ingreso rápido debe tener al menos un ítem',
      );
    }

    const ahora = new Date();
    const fechaStr = dto.fecha ?? ahora.toISOString();

    // número de remito interno automático
    const numeroAuto = `AUTO-${ahora.getFullYear()}${(ahora.getMonth() + 1)
      .toString()
      .padStart(2, '0')}${ahora.getDate().toString().padStart(2, '0')}-${ahora
      .getHours()
      .toString()
      .padStart(2, '0')}${ahora.getMinutes().toString().padStart(2, '0')}${ahora
      .getSeconds()
      .toString()
      .padStart(2, '0')}`;

    // armamos un CreateRemitoDto “normal” poniendo todo en tipo1
    const full: CreateRemitoDto = {
      fecha_remito: fechaStr,
      numero_remito: numeroAuto,
      proveedor_id: null,
      proveedor_nombre: null,
      observaciones: dto.observaciones ?? null,
      items: dto.items.map((i) => ({
        producto_id: i.producto_id,
        unidad: i.unidad ?? 'UN',
        cantidad_total: i.cantidad,
        cantidad_tipo1: i.cantidad, // TODO: después el otro operario puede refinar
        cantidad_tipo2: 0,
        empresa_factura: 'GLADIER', // o lo que uses por defecto
      })),
    } as any;

    // reutilizamos TODA la lógica actual de crearRemito (lotes, validaciones, etc.)
    return this.crearRemito(full);
  }
}

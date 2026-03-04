import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateRemitoDto } from './dto/create-remito.dto';
import { Remito } from './entities/remito.entity';
import { RemitoItem } from './entities/remito-item.entity';
import { StockLote } from '../stock-actual/entities/stock-lote.entity';
import { LoteTipo } from '../enums/lote-tipo.enum';
import { CreateDistribucionRemitoDto } from './dto/distribucion-remito.dto';
import { MovimientoStockDetalle } from '../movimientos/entities/movimiento-stock-detalle.entity';
import { StockActual } from '../stock-actual/entities/stock-actual.entity';
import { LoteAlmacen } from '../lotes-fisicos/entities/lote-almacen.entity';
import { MovimientoStock } from '../movimientos/entities/movimiento-stock.entity';
import { MovimientoTipo } from '../enums/movimiento-tipo.enum';
import { IngresoRapidoRemitoDto } from './dto/ingreso-rapido-remito.dto';
import { CompletarRemitoContableDto } from './dto/completar-remito-contable.dto';
import { QueryRemitosIngresoRapidoDto } from './dto/query-remitos-ingreso-rapido.dto';
import { EmpresaFactura } from '../enums/empresa-factura.enum';
import { Producto } from '../productos/entities/producto.entity';
import { Unidad } from '../productos/entities/unidad.entity';
import { CreateRemitoDirectoDto } from './dto/create-remito-directo.dto';
import { CambiarProveedorRemitoDto } from './dto/cambiar-proveedor-remito.dto';



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

function normalizeOrigen(origen: any): string {
  return String(origen ?? '').trim();
}

function normalizeRemitoExterno(v: any): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.replace(/\s+/g, ' ').toUpperCase();
}

function buildCodigoInterno(now = new Date()): string {
  // REM-YYYYMMDD-HHMMSS-ms (simple, determinista, único “en práctica”)
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `REM-${y}${m}${d}-${hh}${mm}${ss}-${ms}`;
}

@Injectable()
export class RemitosService {
  constructor(private readonly ds: DataSource) {}

  async crearRemito(dto: CreateRemitoDto) {
    if (!dto.items?.length)
      throw new BadRequestException('El remito debe tener al menos un ítem');

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

      const origen = normalizeOrigen((dto as any).origen_camion_txt);
      if (!origen)
        throw new BadRequestException('Debe indicar el origen del camión');

      const now = new Date();
      const codigoInterno = buildCodigoInterno(now);

      const externo = dto.numero_remito; // lo que te mandan en el papel
      const externoNorm = normalizeRemitoExterno(externo);

      // Cabecera
      const remito = await qr.query(
        `INSERT INTO public.stk_remitos
        (fecha_remito, codigo_interno, numero_remito_externo, numero_remito_externo_norm,
         proveedor_id, proveedor_nombre, observaciones, origen_camion_txt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, fecha_remito, codigo_interno, numero_remito_externo, proveedor_id, proveedor_nombre, observaciones, origen_camion_txt`,
        [
          fecha,
          codigoInterno,
          externo ?? null,
          externoNorm,
          dto.proveedor_id ?? null,
          dto.proveedor_nombre ?? null,
          dto.observaciones ?? null,
          origen,
        ],
      );

      const remitoId: string = remito[0].id;
      const itemsOut: any[] = [];

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
        const l1 = await qr.query(
          `INSERT INTO public.stk_lotes
          (remito_item_id, producto_id, fecha_remito, lote_tipo, cantidad_inicial, cantidad_disponible)
         VALUES ($1,$2,$3,1,$4,$4)
         RETURNING id, lote_tipo, cantidad_inicial, cantidad_disponible`,
          [remitoItemId, it.producto_id, fecha, toDecimal4(it.cantidad_tipo1)],
        );
        lotes.push(l1[0]);

        const l2 = await qr.query(
          `INSERT INTO public.stk_lotes
          (remito_item_id, producto_id, fecha_remito, lote_tipo, cantidad_inicial, cantidad_disponible)
         VALUES ($1,$2,$3,2,$4,$4)
         RETURNING id, lote_tipo, cantidad_inicial, cantidad_disponible`,
          [remitoItemId, it.producto_id, fecha, toDecimal4(it.cantidad_tipo2)],
        );
        lotes.push(l2[0]);

        itemsOut.push({ ...itemRow[0], lotes });
      }

      await qr.commitTransaction();
      return { id: remitoId, ...remito[0], items: itemsOut };
    } catch (e: any) {
      await qr.rollbackTransaction();
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
      `SELECT * FROM public.stk_remito_items
        WHERE remito_id = $1 AND anulado = false
        ORDER BY created_at ASC`,
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

    for (const it of dto.items) {
      if (!(it.cantidad_ingresada > 0)) {
        throw new BadRequestException(
          `Cantidad ingresada debe ser > 0 para producto_id=${it.producto_id}`,
        );
      }
      if (it.cantidad_declarada < 0) {
        throw new BadRequestException(
          `Cantidad declarada no puede ser negativa (producto_id=${it.producto_id})`,
        );
      }

      const palletDescarga = it.pallet_descarga === true;
      const palletEstado = (it.pallet_estado ?? null) as any;

      if (!palletDescarga && palletEstado) {
        throw new BadRequestException(
          `pallet_estado solo puede venir si pallet_descarga=true (producto_id=${it.producto_id})`,
        );
      }
      if (palletDescarga && !palletEstado) {
        throw new BadRequestException(
          `Si pallet_descarga=true debe indicar pallet_estado=COMPLETO|PARCIAL (producto_id=${it.producto_id})`,
        );
      }
    }

    const origen = normalizeOrigen((dto as any).origen_camion_txt);
    if (!origen)
      throw new BadRequestException('Debe indicar el origen del camión');

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const ahora = new Date();
      const fechaRemito = dto.fecha ? new Date(dto.fecha) : ahora;
      const codigoInterno = buildCodigoInterno(ahora);

      // snapshot conductor opcional
      let conductorNombre: string | null = null;
      if (dto.conductor_camion_id) {
        const rows = await qr.query(
          `SELECT nombre
           FROM public.stk_conductores_camion
          WHERE id = $1 AND activo = true`,
          [dto.conductor_camion_id],
        );
        if (rows.length) conductorNombre = rows[0].nombre;
      }

      const remRows = await qr.query(
        `
      INSERT INTO public.stk_remitos
        (fecha_remito,
         codigo_interno,
         numero_remito_externo,
         numero_remito_externo_norm,
         proveedor_id,
         proveedor_nombre,
         observaciones,
         almacen_id,
         es_ingreso_rapido,
         pendiente,
         conductor_camion_id,
         conductor_camion_nombre,
         origen_camion_txt)
      VALUES ($1,$2,NULL,NULL,$3,$4,$5,$6,true,true,$7,$8,$9)
      RETURNING id,
                fecha_remito,
                codigo_interno,
                numero_remito_externo,
                proveedor_id,
                proveedor_nombre,
                observaciones,
                almacen_id,
                es_ingreso_rapido,
                pendiente,
                conductor_camion_id,
                conductor_camion_nombre,
                origen_camion_txt
      `,
        [
          fechaRemito,
          codigoInterno,
          dto.proveedor_id ?? null,
          dto.proveedor_nombre ?? null,
          dto.observaciones ?? null,
          dto.almacen_id ?? null,
          dto.conductor_camion_id ?? null,
          conductorNombre,
          origen,
        ],
      );

      const remito = remRows[0];
      const remitoId: string = remito.id;

      const itemsOut: any[] = [];

      for (const it of dto.items) {
        const palletDescarga = it.pallet_descarga === true;
        const palletEstado = palletDescarga ? (it.pallet_estado ?? null) : null;

        const itemRows = await qr.query(
          `
        INSERT INTO public.stk_remito_items
          (remito_id,
           producto_id,
           unidad,
           cantidad_total,
           cantidad_tipo1,
           cantidad_tipo2,
           empresa_factura,
           cantidad_remito,
           nombre_capturado,
           presentacion_txt,
           tamano_txt,
           nota_operario_a,
           pallet_descarga,
           pallet_estado)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id,
                  producto_id,
                  unidad,
                  cantidad_total,
                  cantidad_tipo1,
                  cantidad_tipo2,
                  empresa_factura,
                  cantidad_remito,
                  nombre_capturado,
                  presentacion_txt,
                  tamano_txt,
                  nota_operario_a,
                  pallet_descarga,
                  pallet_estado
        `,
          [
            remitoId,
            it.producto_id,
            null,
            toDecimal4(it.cantidad_ingresada),
            toDecimal4(it.cantidad_ingresada),
            toDecimal4(0),
            'GLADIER',
            toDecimal4(it.cantidad_declarada ?? 0),
            it.nombre_producto ?? null,
            it.presentacion ?? null,
            it.tamano ?? null,
            it.nota ?? null,
            palletDescarga,
            palletEstado,
          ],
        );

        itemsOut.push(itemRows[0]);
      }

      await qr.commitTransaction();
      return { ...remito, id: remitoId, items: itemsOut };
    } catch (e: any) {
      await qr.rollbackTransaction();
      console.error(
        '[POST /stock/remitos/ingreso-rapido] error:',
        e?.detail || e?.message || e,
      );
      throw new BadRequestException(
        e?.detail || e?.message || 'Error creando ingreso rápido',
      );
    } finally {
      await qr.release();
    }
  }

  async completarRemitoContable(
    remitoId: string,
    dto: CompletarRemitoContableDto,
  ) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const prodRepo = qr.manager.getRepository(Producto);
    const unidadRepo = qr.manager.getRepository(Unidad);

    try {
      const remRepo = qr.manager.getRepository(Remito);
      const itemRepo = qr.manager.getRepository(RemitoItem);
      const loteRepo = qr.manager.getRepository(StockLote);

      const remito = await remRepo.findOne({ where: { id: remitoId } });
      if (!remito) throw new NotFoundException('Remito no encontrado');

      // ------------------------------------------------------------
      // Flags de seguridad
      // ------------------------------------------------------------
      const esPreRemito =
        remito.es_ingreso_rapido === true && remito.pendiente === true;

      // ------------------------------------------------------------
      // CABECERA (igual que antes)
      // ------------------------------------------------------------
      if (dto.numero_remito !== undefined) {
        const externo = dto.numero_remito; // puede ser null/undefined según tu dto
        remito.numero_remito_externo = externo === null ? null : externo;
        remito.numero_remito_externo_norm =
          externo === null ? null : normalizeRemitoExterno(externo);
      }
      if (dto.proveedor_id !== undefined) {
        remito.proveedor_id =
          dto.proveedor_id === null ? null : dto.proveedor_id;
      }
      if (dto.proveedor_nombre !== undefined) {
        remito.proveedor_nombre =
          dto.proveedor_nombre === null ? null : dto.proveedor_nombre;
      }
      if (dto.observaciones !== undefined) {
        remito.observaciones =
          dto.observaciones === null ? null : dto.observaciones;
      }
      await remRepo.save(remito);

      // Guardamos acá para el response si hubo MOVE
      let nuevoRemitoId: string | null = null;

      // ============================================================
      // (A) REMOVE (anular items) - SOLO en pre-remito
      // ============================================================
      if (dto.items_remove?.length) {
        if (!esPreRemito) {
          throw new BadRequestException(
            'No se pueden eliminar ítems: el remito ya fue confirmado (pendiente=false)',
          );
        }

        for (const remitoItemId of dto.items_remove) {
          const item = await itemRepo.findOne({
            where: { id: remitoItemId, remito: { id: remitoId } },
          });
          if (!item) {
            throw new BadRequestException(
              `El ítem ${remitoItemId} no pertenece al remito`,
            );
          }

          // validar que no tenga lotes
          const tieneLotes = await qr.query(
            `SELECT 1 FROM public.stk_lotes WHERE remito_item_id = $1 LIMIT 1`,
            [remitoItemId],
          );
          if (tieneLotes.length) {
            throw new BadRequestException(
              `No se puede eliminar el ítem ${remitoItemId}: ya tiene lotes`,
            );
          }

          await qr.query(
            `UPDATE public.stk_remito_items
           SET anulado = true,
               updated_at = NOW()
           WHERE id = $1 AND remito_id = $2`,
            [remitoItemId, remitoId],
          );
        }
      }

      // ============================================================
      // (B) ADD (agregar item) - SOLO en pre-remito
      // ============================================================
      if (dto.items_add?.length) {
        if (!esPreRemito) {
          throw new BadRequestException(
            'No se pueden agregar ítems: el remito ya fue confirmado (pendiente=false)',
          );
        }

        for (const it of dto.items_add) {
          // Validación pallet igual que ingreso rápido
          const palletDescarga = it.pallet_descarga === true;
          const palletEstado = palletDescarga
            ? (it.pallet_estado ?? null)
            : null;

          if (!palletDescarga && palletEstado) {
            throw new BadRequestException(
              `pallet_estado solo puede venir si pallet_descarga=true (producto_id=${it.producto_id})`,
            );
          }
          if (palletDescarga && !palletEstado) {
            throw new BadRequestException(
              `Si pallet_descarga=true debe indicar pallet_estado=COMPLETO|PARCIAL (producto_id=${it.producto_id})`,
            );
          }

          await qr.query(
            `
          INSERT INTO public.stk_remito_items
            (remito_id,
             producto_id,
             unidad,
             cantidad_total,
             cantidad_tipo1,
             cantidad_tipo2,
             empresa_factura,
             cantidad_remito,
             nombre_capturado,
             presentacion_txt,
             tamano_txt,
             nota_operario_a,
             pallet_descarga,
             pallet_estado,
             anulado)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false)
          `,
            [
              remitoId,
              it.producto_id,
              null,
              toDecimal4(it.cantidad_ingresada),
              toDecimal4(it.cantidad_ingresada), // todo tipo1 por defecto
              toDecimal4(0),
              'GLADIER', // igual que ingreso rápido
              toDecimal4(it.cantidad_declarada ?? 0),
              it.nombre_producto ?? null,
              it.presentacion ?? null,
              it.tamano ?? null,
              it.nota ?? null,
              palletDescarga,
              palletEstado,
            ],
          );
        }
      }

      // ============================================================
      // (C) MOVE (split a nuevo remito) - SOLO en pre-remito
      // ============================================================
      if (dto.items_move?.item_ids?.length) {
        if (!esPreRemito) {
          throw new BadRequestException(
            'No se pueden mover ítems: el remito ya fue confirmado (pendiente=false)',
          );
        }

        const provId = dto.items_move.to_new_remito.proveedor_id;

        // validar proveedor en fin_proveedores
        const provRows = await qr.query(
          `SELECT id, nombre
           FROM public.fin_proveedores
          WHERE id=$1 AND activo=true`,
          [provId],
        );
        if (!provRows.length) {
          throw new BadRequestException(
            'Proveedor destino no encontrado o inactivo',
          );
        }

        const proveedorNombre =
          (
            dto.items_move.to_new_remito.proveedor_nombre ??
            provRows[0].nombre ??
            ''
          )
            .toString()
            .trim() || null;

        const nuevoRem = await qr.query(
          `
        INSERT INTO public.stk_remitos
          (fecha_remito,
           numero_remito,
           proveedor_id,
           proveedor_nombre,
           observaciones,
           almacen_id,
           es_ingreso_rapido,
           pendiente,
           conductor_camion_id,
           conductor_camion_nombre,
           origen_camion_txt)
        SELECT
          r.fecha_remito,
          r.numero_remito,
          $1,
          $2,
          $3,
          r.almacen_id,
          true,
          true,
          r.conductor_camion_id,
          r.conductor_camion_nombre,
          r.origen_camion_txt
        FROM public.stk_remitos r
        WHERE r.id = $4
        RETURNING id
        `,
          [
            provId,
            proveedorNombre,
            dto.items_move.to_new_remito.observaciones ?? 'Split automático',
            remitoId,
          ],
        );

        nuevoRemitoId = nuevoRem[0].id;

        // validar items (pertenencia + no anulado + sin lotes)
        for (const itemId of dto.items_move.item_ids) {
          const item = await qr.query(
            `SELECT id, anulado
             FROM public.stk_remito_items
            WHERE id=$1 AND remito_id=$2`,
            [itemId, remitoId],
          );
          if (!item.length) {
            throw new BadRequestException(
              `El ítem ${itemId} no pertenece al remito`,
            );
          }
          if (item[0].anulado === true) {
            throw new BadRequestException(`El ítem ${itemId} está anulado`);
          }

          const tieneLotes = await qr.query(
            `SELECT 1 FROM public.stk_lotes WHERE remito_item_id = $1 LIMIT 1`,
            [itemId],
          );
          if (tieneLotes.length) {
            throw new BadRequestException(
              `No se puede mover el ítem ${itemId}: ya tiene lotes`,
            );
          }
        }

        // mover items al nuevo remito
        await qr.query(
          `
        UPDATE public.stk_remito_items
           SET remito_id = $1,
               updated_at = NOW()
         WHERE remito_id = $2
           AND id = ANY($3::uuid[])
           AND anulado = false
        `,
          [nuevoRemitoId, remitoId, dto.items_move.item_ids],
        );
      }

      // ------------------------------------------------------------
      // ITEMS (AJUSTE + AUTOCOMPLETE)  [igual, pero bloqueando anulados]
      // ------------------------------------------------------------
      const itemsActualizados: RemitoItem[] = [];

      if (dto.items?.length) {
        for (const it of dto.items) {
          const item = await itemRepo.findOne({
            where: { id: it.remito_item_id, remito: { id: remitoId } } as any,
          });

          if (!item) {
            throw new BadRequestException(
              `El ítem ${it.remito_item_id} no pertenece al remito`,
            );
          }

          // 🔒 si el item fue anulado, no permitir que lo editen
          // (si todavía no tenés item.anulado en entity, esto puede dar undefined -> ok)
          if ((item as any).anulado === true) {
            throw new BadRequestException(
              `El ítem ${it.remito_item_id} está anulado y no puede modificarse`,
            );
          }

          // 1) producto REAL
          if (it.producto_id != null) {
            const prod = await prodRepo.findOne({
              where: { id: it.producto_id },
            });
            if (!prod) {
              throw new BadRequestException(
                `Producto ${it.producto_id} no existe en catálogo`,
              );
            }

            item.producto_id = prod.id;

            // Unidad automática
            if (!it.unidad && prod.unidad_id) {
              const unidad = await unidadRepo.findOne({
                where: { id: prod.unidad_id },
              });
              if (unidad) item.unidad = unidad.codigo;
            }

            // Empresa factura automática si no viene override
            if (!it.empresa_factura) {
              const emp = (prod.empresa ?? 'GLADIER').toUpperCase();
              item.empresa_factura = (
                emp === 'SAYRUS' ? 'SAYRUS' : 'GLADIER'
              ) as any;
            }
          }

          // 2) Overrides
          if (it.unidad !== undefined) item.unidad = it.unidad;
          if (it.empresa_factura != null)
            item.empresa_factura = it.empresa_factura as any;
          if (it.cantidad_remito != null)
            item.cantidad_remito = toDecimal4(it.cantidad_remito);

          await itemRepo.save(item);
          itemsActualizados.push(item);
        }
      }

      // ------------------------------------------------------------
      // CREACIÓN DE LOTES FÍSICOS (para TODO item activo del remito)
      // ------------------------------------------------------------
      if (remito.es_ingreso_rapido && remito.pendiente) {
        const fechaLote = remito.fecha_remito;

        // ✅ traer TODOS los items activos (incluye items_add)
        const itemsBase = await qr.query(
          `SELECT id, producto_id, cantidad_total
       FROM public.stk_remito_items
      WHERE remito_id = $1
        AND anulado = false`,
          [remitoId],
        );

        for (const r of itemsBase) {
          const remitoItemId = r.id as string;

          const yaTieneLotes = await loteRepo.findOne({
            where: { remito_item: { id: remitoItemId } } as any,
          });
          if (yaTieneLotes) continue;

          const total = Number(r.cantidad_total);

          const lote = loteRepo.create({
            remito_item: { id: remitoItemId } as any,
            producto_id: Number(r.producto_id),
            fecha_remito: fechaLote,
            lote_tipo: 1,
            cantidad_inicial: toDecimal4(total),
            cantidad_disponible: toDecimal4(total),
            bloqueado: false,
          });

          await loteRepo.save(lote);
        }

        remito.pendiente = false;
        await remRepo.save(remito);
      }

      await qr.commitTransaction();
      return { ok: true, remito_id: remitoId, nuevo_remito_id: nuevoRemitoId };
    } catch (e: any) {
      await qr.rollbackTransaction();
      console.error(
        '[PATCH /stock/remitos/:id/contable] error:',
        e?.detail || e?.message || e,
      );
      throw new BadRequestException(
        e?.detail ||
          e?.message ||
          'Error completando datos contables del remito',
      );
    } finally {
      await qr.release();
    }
  }

  async listarRemitosIngresoRapido(q: QueryRemitosIngresoRapidoDto) {
    const page = q.page && q.page > 0 ? q.page : 1;
    const limit = q.limit && q.limit > 0 ? q.limit : 50;
    const skip = (page - 1) * limit;

    const desde = q.desde ? new Date(q.desde) : undefined;
    const hasta = q.hasta ? new Date(q.hasta) : undefined;

    const soloPend =
      q.solo_pendientes === undefined || q.solo_pendientes === 'true';

    // =========================================================
    // DATA
    // =========================================================
    const qb = this.ds
      .createQueryBuilder()
      .from('stk_remitos', 'r')
      // ✅ IMPORTANTÍSIMO: ignorar items anulados
      .innerJoin(
        'stk_remito_items',
        'ri',
        'ri.remito_id = r.id AND ri.anulado = false',
      )
      .select([
        'r.id               AS id',
        'r.fecha_remito     AS fecha_remito',
        'r.codigo_interno     AS codigo_interno',
        'r.numero_remito_externo AS numero_remito_externo',
        'r.proveedor_id     AS proveedor_id',
        'r.proveedor_nombre AS proveedor_nombre',
        'r.es_ingreso_rapido AS es_ingreso_rapido',
        'r.pendiente        AS pendiente',
      ])
      .addSelect('COUNT(ri.id)', 'items_count')
      .addSelect('SUM(ri.cantidad_total::numeric)', 'cantidad_ingresada_total')
      .addSelect(
        'SUM(COALESCE(ri.cantidad_remito, 0)::numeric)',
        'cantidad_declarada_total',
      )
      .where('r.es_ingreso_rapido = true');

    if (desde) qb.andWhere('r.fecha_remito >= :desde', { desde });
    if (hasta) qb.andWhere('r.fecha_remito < :hasta', { hasta });

    if (q.proveedor_id != null) {
      qb.andWhere('r.proveedor_id = :prov', { prov: q.proveedor_id });
    }

    // ✅ NUEVO: filtrar por producto_id (items)
    if (q.producto_id != null) {
      qb.andWhere('ri.producto_id = :pid', { pid: q.producto_id });
    }

    // ✅ opcional: búsqueda por texto de producto (nombre o codigo_comercial)
    if (q.q_producto && q.q_producto.trim()) {
      qb.innerJoin('stk_productos', 'p', 'p.id = ri.producto_id');
      const s = `%${q.q_producto.trim()}%`;
      qb.andWhere(
        '(LOWER(p.nombre) LIKE LOWER(:s) OR LOWER(p.codigo_comercial) LIKE LOWER(:s))',
        { s },
      );
    }

    

    // ✅ si viene solo_pendientes, filtrar por el valor exacto
    if (q.solo_pendientes !== undefined) {
      qb.andWhere('r.pendiente = :pend', { pend: soloPend });
    } else {
      // comportamiento default: solo pendientes
      qb.andWhere('r.pendiente = true');
    }

    qb.groupBy('r.id')
      // ✅ SOLO remitos cuya suma de cantidades != 0
      .having('SUM(COALESCE(ri.cantidad_total::numeric, 0)) <> 0')
      .orderBy('r.fecha_remito', 'DESC')
      .limit(limit)
      .offset(skip);

    const data = await qb.getRawMany();

    // =========================================================
    // COUNT (consistente: mismos joins/filtros/having)
    // Nota: con GROUP BY/HAVING, el count real es "cantidad de filas"
    // =========================================================
    const countQb = this.ds
      .createQueryBuilder()
      .from('stk_remitos', 'r')
      .innerJoin(
        'stk_remito_items',
        'ri',
        'ri.remito_id = r.id AND ri.anulado = false',
      )
      .select('r.id', 'id')
      .where('r.es_ingreso_rapido = true');

    if (desde) countQb.andWhere('r.fecha_remito >= :desde', { desde });
    if (hasta) countQb.andWhere('r.fecha_remito < :hasta', { hasta });
    if (q.proveedor_id != null)
      countQb.andWhere('r.proveedor_id = :prov', { prov: q.proveedor_id });
    if (q.producto_id != null)
      countQb.andWhere('ri.producto_id = :pid', { pid: q.producto_id });

    if (q.q_producto && q.q_producto.trim()) {
      countQb.innerJoin('stk_productos', 'p', 'p.id = ri.producto_id');
      const s = `%${q.q_producto.trim()}%`;
      countQb.andWhere(
        '(LOWER(p.nombre) LIKE LOWER(:s) OR LOWER(p.codigo_comercial) LIKE LOWER(:s))',
        { s },
      );
    }

    if (q.solo_pendientes !== undefined) {
      countQb.andWhere('r.pendiente = :pend', { pend: soloPend });
    } else {
      countQb.andWhere('r.pendiente = true');
    }

    countQb
      .groupBy('r.id')
      .having('SUM(COALESCE(ri.cantidad_total::numeric, 0)) <> 0');

    const countRows = await countQb.getRawMany();
    const total = countRows.length;

    return { data, total, page, limit };
  }

  async crearRemitoDirecto(dto: CreateRemitoDirectoDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('El remito debe tener al menos un ítem');
    }

    for (const it of dto.items) {
      if (!(it.cantidad_ingresada > 0)) {
        throw new BadRequestException(
          `cantidad_ingresada debe ser > 0 para producto_id=${it.producto_id}`,
        );
      }
      if (it.cantidad_declarada < 0) {
        throw new BadRequestException(
          `cantidad_declarada no puede ser negativa (producto_id=${it.producto_id})`,
        );
      }
    }

    const origen = normalizeOrigen((dto as any).origen_camion_txt);
    if (!origen)
      throw new BadRequestException('Debe indicar el origen del camión');

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const ahora = new Date();
      const fechaRemito = dto.fecha ? new Date(dto.fecha) : ahora;

      const codigoInterno = buildCodigoInterno(ahora);
      const externo = dto.numero_remito;
      const externoNorm = normalizeRemitoExterno(externo);

      const condRows = await qr.query(
        `SELECT nombre
         FROM public.stk_conductores_camion
        WHERE id = $1 AND activo = true`,
        [dto.conductor_camion_id],
      );
      if (!condRows.length)
        throw new BadRequestException('Conductor no encontrado o inactivo');
      const conductorNombre = condRows[0].nombre as string;

      const productoIds = Array.from(
        new Set(dto.items.map((x) => x.producto_id)),
      );

      const productos = await qr.manager.getRepository(Producto).find({
        where: productoIds.map((id) => ({ id })) as any,
        relations: { unidad: true },
      });

      const prodById = new Map<number, Producto>(
        productos.map((p) => [p.id, p]),
      );

      for (const pid of productoIds) {
        if (!prodById.get(pid)) {
          throw new BadRequestException(
            `Producto ${pid} no existe en catálogo`,
          );
        }
      }

      const remRows = await qr.query(
        `
      INSERT INTO public.stk_remitos
        (fecha_remito,
         codigo_interno,
         numero_remito_externo,
         numero_remito_externo_norm,
         proveedor_id,
         proveedor_nombre,
         observaciones,
         almacen_id,
         es_ingreso_rapido,
         pendiente,
         conductor_camion_id,
         conductor_camion_nombre,
         origen_camion_txt)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,false,$9,$10,$11)
      RETURNING id
      `,
        [
          fechaRemito,
          codigoInterno,
          externo,
          externoNorm,
          dto.proveedor_id ?? null,
          dto.proveedor_nombre ?? null,
          dto.observaciones ?? null,
          dto.almacen_id ?? null,
          dto.conductor_camion_id,
          conductorNombre,
          origen,
        ],
      );

      const remitoId: string = remRows[0].id;

      const itemIds: string[] = [];
      for (const it of dto.items) {
        const prod = prodById.get(it.producto_id)!;

        const nombre_producto = prod.nombre;
        const presentacion = prod.unidad?.nombre ?? prod.unidad?.codigo ?? null;
        const tamano = '-';
        const nota = 'Carga directa desde caja.';

        const emp = (prod.empresa ?? 'GLADIER').toUpperCase();
        const empresaFactura = emp === 'SAYRUS' ? 'SAYRUS' : 'GLADIER';

        const itemRows = await qr.query(
          `
        INSERT INTO public.stk_remito_items
          (remito_id,
           producto_id,
           unidad,
           cantidad_total,
           cantidad_tipo1,
           cantidad_tipo2,
           empresa_factura,
           cantidad_remito,
           nombre_capturado,
           presentacion_txt,
           tamano_txt,
           nota_operario_a)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id
        `,
          [
            remitoId,
            it.producto_id,
            null,
            toDecimal4(it.cantidad_ingresada),
            toDecimal4(it.cantidad_ingresada),
            toDecimal4(0),
            empresaFactura,
            toDecimal4(it.cantidad_declarada ?? 0),
            nombre_producto,
            presentacion,
            tamano,
            nota,
          ],
        );

        itemIds.push(itemRows[0].id);
      }

      for (const remitoItemId of itemIds) {
        const row = await qr.query(
          `SELECT producto_id, cantidad_total
           FROM public.stk_remito_items
          WHERE id = $1`,
          [remitoItemId],
        );

        const productoId = Number(row[0].producto_id);
        const total = Number(row[0].cantidad_total);

        await qr.query(
          `INSERT INTO public.stk_lotes
          (remito_item_id, producto_id, fecha_remito, lote_tipo, cantidad_inicial, cantidad_disponible, bloqueado)
         VALUES ($1,$2,$3,1,$4,$4,false)`,
          [remitoItemId, productoId, fechaRemito, toDecimal4(total)],
        );
      }

      await qr.commitTransaction();
      return { ok: true, remito_id: remitoId };
    } catch (e: any) {
      await qr.rollbackTransaction();
      console.error(
        '[POST /stock/remitos/directo] error:',
        e?.detail || e?.message || e,
      );
      throw new BadRequestException(
        e?.detail || e?.message || 'Error creando remito directo',
      );
    } finally {
      await qr.release();
    }
  }

  async cambiarProveedor(remitoId: string, dto: CambiarProveedorRemitoDto) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 1) remito existe
      const rem = await qr.query(
        `SELECT id, proveedor_id, proveedor_nombre
       FROM public.stk_remitos
       WHERE id = $1`,
        [remitoId],
      );
      if (!rem?.length) throw new NotFoundException('Remito no encontrado');

      // 2) proveedor existe y activo (tabla real: fin_proveedores)
      const provRows = await qr.query(
        `SELECT id, nombre
       FROM public.fin_proveedores
       WHERE id = $1 AND activo = true`,
        [dto.proveedor_id],
      );
      if (!provRows.length) {
        throw new BadRequestException('Proveedor no encontrado o inactivo');
      }

      const proveedorNombreFinal =
        (dto.proveedor_nombre ?? provRows[0].nombre ?? '').toString().trim() ||
        null;

      // 3) update cabecera
      const upd = await qr.query(
        `UPDATE public.stk_remitos
       SET proveedor_id = $1,
           proveedor_nombre = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, proveedor_id, proveedor_nombre`,
        [dto.proveedor_id, proveedorNombreFinal, remitoId],
      );

      await qr.commitTransaction();
      return { ok: true, remito: upd[0] };
    } catch (e: any) {
      await qr.rollbackTransaction();
      throw new BadRequestException(
        e?.detail || e?.message || 'Error cambiando proveedor',
      );
    } finally {
      await qr.release();
    }
  }
}

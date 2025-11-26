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

    // Validar cantidades
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
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const ahora = new Date();
      const fechaRemito = dto.fecha ? new Date(dto.fecha) : ahora;

      // número de remito interno automático (solo para identificar)
      const numeroAuto = `AUTO-${ahora.getFullYear()}${(ahora.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${ahora.getDate().toString().padStart(2, '0')}-${ahora
        .getHours()
        .toString()
        .padStart(
          2,
          '0',
        )}${ahora.getMinutes().toString().padStart(2, '0')}${ahora
        .getSeconds()
        .toString()
        .padStart(2, '0')}`;

      // --- Buscar nombre del conductor para snapshot (opcional) ---
      let conductorNombre: string | null = null;
      if (dto.conductor_camion_id) {
        const rows = await qr.query(
          `SELECT nombre
           FROM public.stk_conductores_camion
          WHERE id = $1 AND activo = true`,
          [dto.conductor_camion_id],
        );
        if (rows.length) {
          conductorNombre = rows[0].nombre;
        }
      }

      // --- Insertar cabecera de "pre-remito" (sin lotes) ---
      const remRows = await qr.query(
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
         conductor_camion_nombre)
      VALUES ($1,$2,$3,$4,$5,$6,true,true,$7,$8)
      RETURNING id,
                fecha_remito,
                numero_remito,
                proveedor_id,
                proveedor_nombre,
                observaciones,
                almacen_id,
                es_ingreso_rapido,
                pendiente,
                conductor_camion_id,
                conductor_camion_nombre
      `,
        [
          fechaRemito,
          numeroAuto,
          dto.proveedor_id ?? null,
          dto.proveedor_nombre ?? null,
          dto.observaciones ?? null,
          dto.conductor_camion_id ?? null,
          dto.almacen_id ?? null,
          conductorNombre,
        ],
      );

      const remito = remRows[0];
      const remitoId: string = remito.id;

      const itemsOut: any[] = [];

      // --- Insertar ítems "sucios" del Operario A ---
      for (const it of dto.items) {
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
                  nota_operario_a
        `,
          [
            remitoId,
            it.producto_id,
            null, // unidad real la define el Operario B
            toDecimal4(it.cantidad_ingresada), // física real
            toDecimal4(it.cantidad_ingresada), // todo tipo1 por defecto (solo contable)
            toDecimal4(0),
            'GLADIER', // o el default que uses
            toDecimal4(it.cantidad_declarada ?? 0),
            it.nombre_producto ?? null,
            it.presentacion ?? null,
            it.tamano ?? null,
            it.nota ?? null,
          ],
        );

        itemsOut.push(itemRows[0]);
      }

      await qr.commitTransaction();

      // Devolvemos el "pre-remito" creado (sin lotes)
      return {
        ...remito,
        id: remitoId,
        items: itemsOut,
      };
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

    const remito = await remRepo.findOne({ where: { id: remitoId } });
    if (!remito) {
      throw new NotFoundException('Remito no encontrado');
    }

    // ---------- CABECERA ----------
    if (dto.numero_remito !== undefined && dto.numero_remito !== null) {
      remito.numero_remito = dto.numero_remito;
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

    const itemsActualizados: RemitoItem[] = [];

    // ---------- ITEMS (AJUSTE + AUTOCOMPLETE) ----------
    if (dto.items?.length) {
      for (const it of dto.items) {
        const item = await itemRepo.findOne({
          where: { id: it.remito_item_id, remito: { id: remitoId } },
        });

        if (!item) {
          throw new BadRequestException(
            `El ítem ${it.remito_item_id} no pertenece al remito`,
          );
        }

        // 1) Si vino producto_id, lo tomamos como producto REAL
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

          // Unidad automática desde maestro si:
          // - el DTO no trae unidad
          // - y el producto tiene unidad_id válido
          if (!it.unidad && prod.unidad_id) {
            const unidad = await unidadRepo.findOne({
              where: { id: prod.unidad_id },
            });
            if (unidad) {
              item.unidad = unidad.codigo;
            }
          }

          // Empresa factura automática si:
          // - el DTO no la manda
          // - y el producto tiene empresa GLADIER / SAYRUS
          if (!it.empresa_factura && prod.empresa) {
            const emp = prod.empresa.toUpperCase();
            if (emp === 'GLADIER' || emp === 'SAYRUS') {
              item.empresa_factura = emp as EmpresaFactura;
            }
          }
        }

        // 2) Overrides manuales desde DTO
        if (it.unidad !== undefined) {
          item.unidad = it.unidad;
        }
        if (it.empresa_factura != null) {
          item.empresa_factura = it.empresa_factura as any;
        }
        if (it.cantidad_remito != null) {
          item.cantidad_remito = toDecimal4(it.cantidad_remito);
        }

        // 3) NO tocamos cantidad_tipo1 / cantidad_tipo2 aquí
        await itemRepo.save(item);
        itemsActualizados.push(item);
      }
    }

    // ---------- CREACIÓN DE LOTES FÍSICOS ----------
    // Solo si era un pre-remito de ingreso rápido y está pendiente
    if (remito.es_ingreso_rapido && remito.pendiente) {
      const fechaLote = remito.fecha_remito;

      let itemsBase: RemitoItem[];
      if (itemsActualizados.length) {
        itemsBase = itemsActualizados;
      } else {
        itemsBase = await itemRepo.find({ where: { remito: { id: remitoId } } });
      }

      const loteRepo = qr.manager.getRepository(StockLote);

      for (const item of itemsBase) {
        // si por algún motivo ya tiene lotes, no duplicamos
        const yaTieneLotes = await loteRepo.findOne({
          where: { remito_item: { id: item.id } },
        });
        if (yaTieneLotes) continue;

        const total = Number(item.cantidad_total);

        // Por ahora, todo el stock físico va como lote_tipo=1
        const lote = loteRepo.create({
          remito_item: { id: item.id } as any,
          producto_id: item.producto_id,
          fecha_remito: fechaLote,
          lote_tipo: 1, // físico, no contable
          cantidad_inicial: toDecimal4(total),
          cantidad_disponible: toDecimal4(total),
          bloqueado: false,
        });

        await loteRepo.save(lote);
      }

      // Ya no es pendiente: tiene lotes físicos y datos contables básicos
      remito.pendiente = false;
      await remRepo.save(remito);
    }

    await qr.commitTransaction();
    return { ok: true, remito_id: remitoId };
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

    const qb = this.ds
      .createQueryBuilder()
      .from('stk_remitos', 'r')
      .innerJoin('stk_remito_items', 'ri', 'ri.remito_id = r.id')
      .select([
        'r.id              AS id',
        'r.fecha_remito    AS fecha_remito',
        'r.numero_remito   AS numero_remito',
        'r.proveedor_id    AS proveedor_id',
        'r.proveedor_nombre AS proveedor_nombre',
        'r.es_ingreso_rapido AS es_ingreso_rapido',
      ])
      .addSelect('COUNT(ri.id)', 'items_count')
      .addSelect('SUM(ri.cantidad_total)', 'cantidad_ingresada_total')
      .addSelect(
        'SUM(COALESCE(ri.cantidad_remito, 0))',
        'cantidad_declarada_total',
      )
      .where('r.es_ingreso_rapido = true')
      .groupBy('r.id');

    if (desde) {
      qb.andWhere('r.fecha_remito >= :desde', { desde });
    }
    if (hasta) {
      qb.andWhere('r.fecha_remito < :hasta', { hasta });
    }
    if (q.proveedor_id) {
      qb.andWhere('r.proveedor_id = :prov', { prov: q.proveedor_id });
    }

    if (soloPend) {
      qb.andWhere('r.pendiente = true');
    }

    qb.orderBy('r.fecha_remito', 'DESC').limit(limit).offset(skip);

    const data = await qb.getRawMany();

    const countQb = this.ds
      .createQueryBuilder()
      .from('stk_remitos', 'r')
      .innerJoin('stk_remito_items', 'ri', 'ri.remito_id = r.id')
      .select('COUNT(DISTINCT r.id)', 'c')
      .where('r.es_ingreso_rapido = true');

    if (desde) countQb.andWhere('r.fecha_remito >= :desde', { desde });
    if (hasta) countQb.andWhere('r.fecha_remito < :hasta', { hasta });
    if (q.proveedor_id)
      countQb.andWhere('r.proveedor_id = :prov', { prov: q.proveedor_id });
    if (soloPend) {
      countQb.andWhere(
        `(
          r.numero_remito IS NULL
          OR EXISTS (
            SELECT 1 FROM public.stk_remito_items x
            WHERE x.remito_id = r.id
              AND (x.cantidad_remito IS NULL)
          )
        )`,
      );
    }

    const total = await countQb.getRawOne().then((r: any) => Number(r?.c) || 0);

    return { data, total, page, limit };
  }
}

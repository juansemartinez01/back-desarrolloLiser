import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ReservasService } from '../reservas/reservas.service';
import { RegistrarVentaDto } from './dto/venta.dto';
import { MovimientoStock } from './entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from './entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from '../enums/movimiento-tipo.enum';
import { ConfirmarVentaDto } from './dto/confirmar-venta.dto';
import { VaciosService } from '../vacios/vacios.service';
@Injectable()
export class VentasService {
  constructor(
    private readonly ds: DataSource,
    private readonly reservasService: ReservasService,
    private readonly vaciosService: VaciosService,
  ) {}

  async confirmarVenta(dto: ConfirmarVentaDto) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    // ✅ fecha única del servidor (UTC)
    const fechaServer = new Date();

    try {
      // 1) Confirmar reservas (idealmente en la misma tx; si este service usa su propio DS, esto no lo garantiza)
      await this.reservasService.confirmar({
        reservas_ids: dto.reservas_ids,
        pedido_id: dto.pedido_id,
      });

      // 2) Ejecutar la venta usando MISMA transacción y fecha del servidor
      const venta = await this.registrarVenta(
        {
          lineas: dto.lineas,
          almacen_origen_id: dto.almacen_origen_id,
          observacion: dto.observacion,
          referencia_id: dto.referencia_id,
        },
        qr,
        
      );

      // 3) Vacíos: misma tx + misma fecha server
      if (dto.vacios?.length) {
        await this.vaciosService.registrarEntregaPedidoTx(qr, {
          cliente_id: dto.cliente_id,
          pedido_id: dto.pedido_id,
          pedido_codigo: dto.referencia_id, // "PED-..."
          fecha: fechaServer.toISOString(), // ✅ normalizado (server time UTC)
          items: dto.vacios,
        });
      }

      await qr.commitTransaction();
      return {
        ok: true,
        venta,
        mensaje: 'Venta confirmada y reservas consumidas',
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

 

async registrarVenta(dto: RegistrarVentaDto, qrExternal?: QueryRunner) {
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

  // ✅ NORMALIZADO: fecha SIEMPRE del servidor (UTC). No se usa dto.fecha.
  const fecha = new Date();

  const refCodificada = generarReferenciaVenta(
    dto.referencia_id,
    fecha.toISOString(),
  );

  // ✅ Si viene QR externo, lo usamos. Si no viene, creamos como antes.
  const qr = qrExternal ?? this.ds.createQueryRunner();
  const ownsTransaction = !qrExternal;

  if (ownsTransaction) {
    await qr.connect();
    await qr.startTransaction();
  }

  try {
    // ✅ NORMALIZADO: reutilizamos fecha server (sin cambiar estructura)
    const fecha = new Date();

    // Cabecera movimiento
    const mov = await qr.manager.save(
      qr.manager.create(MovimientoStock, {
        tipo: MovimientoTipo.VENTA,
        fecha,
        almacen_origen_id: dto.almacen_origen_id, // se usa por detalle
        almacen_destino_id: null,
        referencia_tipo: 'VENTA',
        referencia_id: refCodificada ?? null,
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

    if (ownsTransaction) {
      await qr.commitTransaction();
    }

    return {
      ok: true,
      movimiento_id: mov.id,
      detalles: detallesResumen,
    };
  } catch (e) {
    if (ownsTransaction) {
      await qr.rollbackTransaction();
    }
    console.error('[POST /stock/movimientos/venta] error:', e?.message || e);
    throw new BadRequestException(
      e?.detail || e?.message || 'Error registrando venta de stock',
    );
  } finally {
    if (ownsTransaction) {
      await qr.release();
    }
  }


// helpers/ventas.helpers.ts (o en el mismo service, arriba del @Injectable)
// helpers/ventas.helpers.ts
function generarReferenciaVenta(
  referenciaLibre?: string | null,
  fechaFallbackIso?: string, // opcional, por si hay que usar fallback
): string {
  const PREFIX = 'VTA';

  // ---------------------------------
  // 1) Nombre → VALFRITADRI
  // ---------------------------------
  let parteNombre = 'SIN NOMBRE';

  if (referenciaLibre) {
    const partes = referenciaLibre.split(' - ');
    if (partes[0]) {
      parteNombre = partes[0].trim();
    }
  }

  const soloLetras = parteNombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^A-Za-z\s]/g, ' ') // deja solo letras y espacios
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const palabras = soloLetras.split(' ').filter(Boolean);
  const trozos: string[] = [];

  for (const p of palabras) {
    trozos.push(p.slice(0, 3)); // primeras 3 letras de cada palabra
    if (trozos.join('').length >= 12) break;
  }

  let codNombre = trozos.join('') || 'SINNOM';
  codNombre = codNombre.slice(0, 12);

  // ---------------------------------
  // 2) Fecha y hora desde referenciaLibre
  //    Formato esperado: " ... - 12 nov 2025, 14:47:50"
  // ---------------------------------
  let fechaStr: string | undefined;
  let horaStr: string | undefined;

  if (referenciaLibre) {
    const partes = referenciaLibre.split(' - ');
    const resto = partes[1]?.trim() || ''; // "12 nov 2025, 14:47:50"

    if (resto) {
      const [fechaTextoRaw, horaTextoRaw] = resto.split(',').map((x) => x.trim());
      const fechaTexto = fechaTextoRaw || '';
      const horaTexto = horaTextoRaw || '';

      const meses: Record<string, string> = {
        ene: '01',
        feb: '02',
        mar: '03',
        abr: '04',
        may: '05',
        jun: '06',
        jul: '07',
        ago: '08',
        sep: '09',
        oct: '10',
        nov: '11',
        dic: '12',
      };

      if (fechaTexto && horaTexto) {
        // "12 nov 2025"
        const [ddStrRaw, mesStrRaw, yyyyStrRaw] = fechaTexto.split(/\s+/);
        const ddStr = ddStrRaw || '';
        const mesStr = (mesStrRaw || '').toLowerCase();
        const yyyyStr = yyyyStrRaw || '';

        const mesNum = meses[mesStr];

        if (
          mesNum &&
          /^\d{1,2}$/.test(ddStr) &&
          /^\d{4}$/.test(yyyyStr) &&
          /^\d{2}:\d{2}:\d{2}$/.test(horaTexto)
        ) {
          const dd = ddStr.padStart(2, '0');
          fechaStr = `${dd}/${mesNum}/${yyyyStr}`; // DD/MM/YYYY
          horaStr = horaTexto; // HH:mm:ss tal cual vino
        }
      }
    }
  }

  // ---------------------------------
  // 3) Fallback de fecha/hora si no se pudo parsear de referenciaLibre
  // ---------------------------------
  if (!fechaStr || !horaStr) {
    const baseDate = fechaFallbackIso ? new Date(fechaFallbackIso) : new Date();
    const dd = String(baseDate.getDate()).padStart(2, '0');
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const yyyy = baseDate.getFullYear();
    const hh = String(baseDate.getHours()).padStart(2, '0');
    const mi = String(baseDate.getMinutes()).padStart(2, '0');
    const ss = String(baseDate.getSeconds()).padStart(2, '0');

    fechaStr = `${dd}/${mm}/${yyyy}`;
    horaStr = `${hh}:${mi}:${ss}`;
  }

  // ---------------------------------
  // 4) Número aleatorio de 12 dígitos
  // ---------------------------------
  const aleatorio = Math.floor(Math.random() * 1e12)
    .toString()
    .padStart(12, '0');

  // VTA-VALFRITADRI-12/11/2025-14:47:50-004586582153
  return `${PREFIX}-${codNombre}-${fechaStr}-${horaStr}-${aleatorio}`;
}

}}

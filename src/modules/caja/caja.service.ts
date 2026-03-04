// src/caja/caja.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CajaApertura } from './entities/caja-apertura.entity';
import { CajaMovimiento } from './entities/caja-movimiento.entity';
import { CajaCierre } from './entities/caja-cierre.entity';
import { AperturaDto } from './dto/apertura.dto';
import { MovimientoDto } from './dto/movimiento.dto';
import { CerrarCajaDto } from './dto/cierre.dto';
import { Sucursal } from '../sucursales/sucursal.entity';
import { MetodoPago } from './enums/metodo-pago.enum';
import { TarjetaTipo } from './enums/tarjeta-tipo.enum';
import { TipoMovimiento } from './enums/tipo-movimiento.enum';
import { CajaMovimientoDetalle } from './entities/caja-movimiento-detalle.entity';
import { QueryPanelCajaDto } from './dto/query-panel-caja.dto';

@Injectable()
export class CajaService {
  constructor(
    @InjectRepository(CajaApertura)
    private readonly aperturaRepo: Repository<CajaApertura>,

    @InjectRepository(CajaMovimiento)
    private readonly movRepo: Repository<CajaMovimiento>,

    @InjectRepository(CajaCierre)
    private readonly cierreRepo: Repository<CajaCierre>,

    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,

    private readonly ds: DataSource,
  ) {}

  // -------------------------
  // Helpers
  // -------------------------
  private toNumber2(n: any): number {
    const x = Number(n);
    if (!Number.isFinite(x)) return NaN;
    return Math.round(x * 100) / 100;
  }

  private normalizarPagos(dto: MovimientoDto) {
    // Si viene nuevo
    if (dto.pagos && dto.pagos.length) {
      return dto.pagos.map((p) => ({
        metodoPago: p.metodoPago,
        monto: this.toNumber2(p.monto),
        tarjetaTipo: p.tarjetaTipo,
        tarjetaUltimos4: p.tarjetaUltimos4,
        codigoAutorizacion: p.codigoAutorizacion,
        nombreEntidad: p.nombreEntidad,
      }));
    }

    // Compat viejo -> lo convertimos a pagos[0]
    if (!dto.metodoPago || dto.monto == null) {
      throw new BadRequestException(
        'Debe venir pagos[] o (metodoPago + monto)',
      );
    }

    return [
      {
        metodoPago: dto.metodoPago,
        monto: this.toNumber2(dto.monto),
        tarjetaTipo: dto.tarjetaTipo,
        tarjetaUltimos4: dto.tarjetaUltimos4,
        codigoAutorizacion: dto.codigoAutorizacion,
        nombreEntidad: dto.nombreEntidad,
      },
    ];
  }

  private validarPagos(pagos: Array<any>) {
    if (!pagos.length) throw new BadRequestException('pagos requerido');

    let sum = 0;

    for (const p of pagos) {
      if (!p.metodoPago) throw new BadRequestException('metodoPago requerido');
      if (!(p.monto > 0)) throw new BadRequestException('monto debe ser > 0');

      sum += p.monto;

      // Reglas por método
      if (p.metodoPago === MetodoPago.TARJETA) {
        if (!p.tarjetaTipo) {
          throw new BadRequestException('tarjetaTipo requerido para TARJETA');
        }
        // opcional: últimos 4 si querés forzarlo:
        // if (!p.tarjetaUltimos4) throw new BadRequestException('tarjetaUltimos4 requerido para TARJETA');
      }
    }

    sum = this.toNumber2(sum);
    if (!(sum > 0)) throw new BadRequestException('Suma de pagos inválida');

    return { total: sum };
  }

  // 👉 APERTURA DE CAJA
  async abrir(dto: AperturaDto) {
    const abierta = await this.aperturaRepo.findOne({
      where: { abierta: true },
    });
    if (abierta) throw new BadRequestException('Ya existe una caja abierta');

    const sucursal = await this.sucursalRepo.findOne({
      where: { id: dto.sucursalId },
    });
    if (!sucursal) throw new BadRequestException('Sucursal no encontrada');

    const apertura = this.aperturaRepo.create({
      fechaApertura: new Date(),
      saldoInicial: dto.saldoInicial,
      usuarioApertura: dto.usuario,
      abierta: true,
      sucursalId: sucursal.id, // ✅ clave
      sucursal,
    });

    return await this.aperturaRepo.save(apertura);
  }

  // -------------------------
  // Movimiento (split payments)
  // -------------------------
  async movimiento(dto: MovimientoDto) {
    return this.ds.transaction(async (manager) => {
      const apertura = await manager.getRepository(CajaApertura).findOne({
        where: { abierta: true },
      });
      if (!apertura) throw new BadRequestException('No hay caja abierta');

      const pagos = this.normalizarPagos(dto);
      const { total } = this.validarPagos(pagos);

      // Cabecera
      const mov = manager.getRepository(CajaMovimiento).create({
        aperturaId: apertura.id,
        apertura,
        fecha: new Date(),
        tipo: dto.tipo,

        // ✅ consistencia con tu entity (string | null)
        referencia: dto.referencia ?? null,

        usuario: dto.usuario,
        montoTotal: total,

        // ✅ compat viejo: guardo resumen (opcional)
        monto: total,
        metodoPago: pagos.length === 1 ? pagos[0].metodoPago : null,
        tarjetaTipo: pagos.length === 1 ? (pagos[0].tarjetaTipo ?? null) : null,
        tarjetaUltimos4:
          pagos.length === 1 ? (pagos[0].tarjetaUltimos4 ?? null) : null,
        codigoAutorizacion:
          pagos.length === 1 ? (pagos[0].codigoAutorizacion ?? null) : null,
        nombreEntidad:
          pagos.length === 1 ? (pagos[0].nombreEntidad ?? null) : null,
      });

      const savedMov = await manager.getRepository(CajaMovimiento).save(mov);

      // Detalles
      const detRepo = manager.getRepository(CajaMovimientoDetalle);

      const detalles = pagos.map((p) =>
        detRepo.create({
          movimiento: savedMov, // ✅ suficiente
          metodoPago: p.metodoPago,
          monto: p.monto,
          tarjetaTipo: p.tarjetaTipo ?? undefined,
          tarjetaUltimos4: p.tarjetaUltimos4 ?? undefined,
          codigoAutorizacion: p.codigoAutorizacion ?? undefined,
          nombreEntidad: p.nombreEntidad ?? undefined,
        }),
      );

      await detRepo.save(detalles);

      // devolvemos con detalles (útil para UI)
      return {
        ...savedMov,
        detalles,
      };
    });
  }

  // -------------------------
  // Cierre: totales por detalle
  // -------------------------
  async cerrar(dto: CerrarCajaDto) {
    return this.ds.transaction(async (manager) => {
      const apertura = await manager.getRepository(CajaApertura).findOne({
        where: { abierta: true },
      });
      if (!apertura) throw new BadRequestException('No hay caja abierta');

      // Totales por método (SQL eficiente)
      const rows = await manager.query(
        `
        SELECT
          d.metodo_pago AS metodo,
          COALESCE(SUM(
            d.monto *
            CASE WHEN m.tipo = 'INGRESO' THEN 1 ELSE -1 END
          ),0)::numeric(12,2) AS total
        FROM caja_movimiento m
        JOIN caja_movimiento_detalle d ON d.movimiento_id = m.id
        WHERE m.apertura_id = $1
        GROUP BY d.metodo_pago
        `,
        [apertura.id],
      );

      const totales: Record<string, number> = {
        EFECTIVO: 0,
        TARJETA: 0,
        TRANSFERENCIA: 0,
        BILLETERA: 0,
        CHEQUE: 0,
        CTA_CORRIENTE: 0,
      };

      for (const r of rows) {
        const metodo = String(r.metodo);
        if (totales[metodo] !== undefined) {
          totales[metodo] = Number(r.total);
        }
      }

      const saldoInicial = Number(apertura.saldoInicial);

      const totalCalculado =
        saldoInicial +
        Object.values(totales).reduce((a, b) => Number(a) + Number(b), 0);

      const diferencia = Number(dto.totalRealEfectivo) - Number(totalCalculado);

      const cierre = manager.getRepository(CajaCierre).create({
        apertura,
        fechaCierre: new Date(),
        totalEfectivo: totales.EFECTIVO,
        totalTarjetas: totales.TARJETA,
        totalTransferencias: totales.TRANSFERENCIA,
        totalBilleteras: totales.BILLETERA,
        totalCheques: totales.CHEQUE,
        totalCuentaCorriente: totales.CTA_CORRIENTE,
        totalTeorico: Number(totalCalculado.toFixed(2)),
        totalRealEfectivo: Number(dto.totalRealEfectivo),
        diferencia: Number(diferencia.toFixed(2)),
        observaciones: dto.observaciones,
        usuarioCierre: dto.usuario,
      });

      await manager.getRepository(CajaCierre).save(cierre);

      // cerrar caja
      apertura.abierta = false;
      await manager.getRepository(CajaApertura).save(apertura);

      return cierre;
    });
  }

  // -------------------------
  // Estado sucursal: totales por detalle + saldo teórico
  // -------------------------
  async estadoSucursal(sucursalId: string) {
    const apertura = await this.aperturaRepo.findOne({
      where: { sucursalId, abierta: true },
    });

    if (!apertura) {
      return {
        sucursalId,
        cajaAbierta: false,
        mensaje: 'La sucursal no tiene caja abierta actualmente',
      };
    }

    const rows = await this.aperturaRepo.manager.query(
      `
      SELECT
        d.metodo_pago AS metodo,
        COALESCE(SUM(
          d.monto *
          CASE WHEN m.tipo = 'INGRESO' THEN 1 ELSE -1 END
        ),0)::numeric(12,2) AS total,
        COUNT(DISTINCT m.id)::int AS movimientos
      FROM caja_movimiento m
      JOIN caja_movimiento_detalle d ON d.movimiento_id = m.id
      WHERE m.apertura_id = $1
      GROUP BY d.metodo_pago
      `,
      [apertura.id],
    );

    const totales: Record<string, number> = {
      EFECTIVO: 0,
      TARJETA: 0,
      TRANSFERENCIA: 0,
      BILLETERA: 0,
      CHEQUE: 0,
      CTA_CORRIENTE: 0,
    };

    let cantMovs = 0;
    for (const r of rows) {
      const metodo = String(r.metodo);
      if (totales[metodo] !== undefined) totales[metodo] = Number(r.total);
      cantMovs = Math.max(cantMovs, Number(r.movimientos ?? 0));
    }

    const saldoInicial = Number(apertura.saldoInicial);
    const saldoTeorico =
      saldoInicial +
      Object.values(totales).reduce((a, b) => Number(a) + Number(b), 0);

    return {
      sucursalId,
      cajaAbierta: true,
      apertura: {
        id: apertura.id,
        fechaApertura: apertura.fechaApertura,
        usuarioApertura: apertura.usuarioApertura,
        saldoInicial,
      },
      totalesPorMetodo: totales,
      saldoTeorico: Number(saldoTeorico.toFixed(2)),
      cantidadMovimientos: cantMovs,
    };
  }

  /*------------------------------------------------------------*/
  getMetodosPago() {
    return Object.values(MetodoPago).map((v) => ({
      label: v,
      value: v,
    }));
  }

  getTiposTarjeta() {
    return Object.values(TarjetaTipo).map((v) => ({
      label: v,
      value: v,
    }));
  }

  getTiposMovimiento() {
    return Object.values(TipoMovimiento).map((v) => ({
      label: v,
      value: v,
    }));
  }

  async getConfiguracionCaja() {
    const sucursales = await this.sucursalRepo.find({
      select: ['id', 'nombre'],
    });

    return {
      metodosPago: this.getMetodosPago(),
      tiposTarjeta: this.getTiposTarjeta(),
      tiposMovimiento: this.getTiposMovimiento(),
      sucursales: sucursales.map((s) => ({
        label: s.nombre,
        value: s.id,
      })),
    };
  }

  // =========================================================
  // PANEL: movimientos + detalles + resumen (con filtros)
  // =========================================================
  async panelMovimientos(q: QueryPanelCajaDto) {
    const page = Number(q.page ?? 1);
    const limit = Number(q.limit ?? 50);
    const offset = (page - 1) * limit;

    const orderBy = q.orderBy === 'montoTotal' ? 'm.monto_total' : 'm.fecha';
    const orderDir =
      (q.orderDir ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const desde = q.desde ? new Date(q.desde) : null;
    const hasta = q.hasta ? new Date(q.hasta) : null;

    if (desde && Number.isNaN(desde.getTime()))
      throw new BadRequestException('desde inválido');
    if (hasta && Number.isNaN(hasta.getTime()))
      throw new BadRequestException('hasta inválido');
    if (desde && hasta && desde > hasta)
      throw new BadRequestException('desde no puede ser > hasta');

    // 1) Resolver aperturaId si no viene
    let aperturaId = q.aperturaId ?? null;

    if (!aperturaId && q.sucursalId) {
      // Si no pasan aperturaId, elegimos:
      // - si hay caja abierta en esa sucursal => esa
      // - si no, la última apertura que caiga dentro del rango (o última en general)
      const abierta = await this.aperturaRepo.findOne({
        where: { sucursalId: q.sucursalId, abierta: true },
        select: [
          'id',
          'fechaApertura',
          'sucursalId',
          'usuarioApertura',
          'saldoInicial',
          'abierta',
        ],
      });

      if (abierta) {
        aperturaId = abierta.id;
      } else {
        // última según rango (si hay fechas) o última en general
        const whereParts: string[] = ['a.sucursal_id = $1'];
        const params: any[] = [q.sucursalId];
        let p = params.length;

        if (desde) {
          whereParts.push(`a.fecha_apertura >= $${++p}`);
          params.push(desde);
        }
        if (hasta) {
          whereParts.push(`a.fecha_apertura <= $${++p}`);
          params.push(hasta);
        }

        const rows = await this.ds.query(
          `
          SELECT a.id
          FROM caja_apertura a
          WHERE ${whereParts.join(' AND ')}
          ORDER BY a.fecha_apertura DESC
          LIMIT 1
          `,
          params,
        );

        aperturaId = rows?.[0]?.id ?? null;
      }
    }

    if (!aperturaId) {
      throw new BadRequestException(
        'Debe venir aperturaId o sucursalId (con una apertura resolvible)',
      );
    }

    // 2) WHERE dinámico (siempre filtramos por aperturaId)
    const where: string[] = ['m.apertura_id = $1'];
    const params: any[] = [aperturaId];
    let idx = 1;

    if (desde) {
      where.push(`m.fecha >= $${++idx}`);
      params.push(desde);
    }
    if (hasta) {
      where.push(`m.fecha <= $${++idx}`);
      params.push(hasta);
    }
    if (q.tipo) {
      where.push(`m.tipo = $${++idx}`);
      params.push(q.tipo);
    }
    if (q.usuario) {
      where.push(`m.usuario ILIKE $${++idx}`);
      params.push(`%${q.usuario}%`);
    }
    if (q.q) {
      // busca por id / referencia / usuario
      where.push(
        `(CAST(m.id AS text) ILIKE $${++idx} OR COALESCE(m.referencia,'') ILIKE $${idx} OR m.usuario ILIKE $${idx})`,
      );
      params.push(`%${q.q}%`);
    }
    if (q.metodosPago?.length) {
      // filtra por existencia de algún detalle con esos métodos
      where.push(
        `EXISTS (
          SELECT 1
          FROM caja_movimiento_detalle d
          WHERE d.movimiento_id = m.id
            AND d.metodo_pago = ANY($${++idx})
        )`,
      );
      params.push(q.metodosPago);
    }

    const whereSql = where.join(' AND ');

    // 3) Total count (para paginar)
    const countRows = await this.ds.query(
      `SELECT COUNT(*)::int AS total FROM caja_movimiento m WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRows?.[0]?.total ?? 0);

    // 4) Traer IDs paginados (rápido)
    const idRows = await this.ds.query(
      `
      SELECT m.id
      FROM caja_movimiento m
      WHERE ${whereSql}
      ORDER BY ${orderBy} ${orderDir}, m.id ${orderDir}
      LIMIT $${++idx} OFFSET $${++idx}
      `,
      [...params, limit, offset],
    );
    const ids: string[] = idRows.map((r: any) => r.id);

    if (!ids.length) {
      // igual devolvemos resumen/facets en 0 para UI consistente
      return {
        aperturaId,
        paginacion: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        resumen: {
          netoGeneral: 0,
          netoPorMetodo: {
            EFECTIVO: 0,
            TARJETA: 0,
            TRANSFERENCIA: 0,
            BILLETERA: 0,
            CHEQUE: 0,
            CTA_CORRIENTE: 0,
          },
        },
        facets: {
          porTipo: { INGRESO: 0, EGRESO: 0 },
          porMetodo: {
            EFECTIVO: 0,
            TARJETA: 0,
            TRANSFERENCIA: 0,
            BILLETERA: 0,
            CHEQUE: 0,
            CTA_CORRIENTE: 0,
          },
        },
        items: [],
      };
    }

    // 5) Traer items + detalles (en 2 queries para que sea escalable)
    const movs = await this.ds.query(
      `
      SELECT
        m.id,
        m.apertura_id AS "aperturaId",
        m.fecha,
        m.monto_total AS "montoTotal",
        m.tipo,
        m.referencia,
        m.usuario,
        m.metodo_pago AS "metodoPago",
        m.monto,
        m.tarjeta_tipo AS "tarjetaTipo",
        m.tarjeta_ultimos4 AS "tarjetaUltimos4",
        m.codigo_autorizacion AS "codigoAutorizacion",
        m.nombre_entidad AS "nombreEntidad"
      FROM caja_movimiento m
      WHERE m.id = ANY($1)
      ORDER BY ${orderBy} ${orderDir}, m.id ${orderDir}
      `,
      [ids],
    );

    const dets = await this.ds.query(
      `
      SELECT
        d.id,
        d.movimiento_id AS "movimientoId",
        d.metodo_pago AS "metodoPago",
        d.monto,
        d.tarjeta_tipo AS "tarjetaTipo",
        d.tarjeta_ultimos4 AS "tarjetaUltimos4",
        d.codigo_autorizacion AS "codigoAutorizacion",
        d.nombre_entidad AS "nombreEntidad"
      FROM caja_movimiento_detalle d
      WHERE d.movimiento_id = ANY($1)
      ORDER BY d.movimiento_id, d.id
      `,
      [ids],
    );

    const detByMov = new Map<string, any[]>();
    for (const d of dets) {
      const arr = detByMov.get(d.movimientoId) ?? [];
      arr.push(d);
      detByMov.set(d.movimientoId, arr);
    }

    const items = movs.map((m: any) => ({
      ...m,
      detalles: detByMov.get(m.id) ?? [],
    }));

    // 6) Resumen neto por método (con signo por tipo movimiento)
    //    Nota: esto respeta filtros (incluyendo metodosPago, q, usuario, etc.)
    const resumenRows = await this.ds.query(
      `
      SELECT
        d.metodo_pago AS metodo,
        COALESCE(SUM(
          d.monto *
          CASE WHEN m.tipo = 'INGRESO' THEN 1 ELSE -1 END
        ),0)::numeric(12,2) AS total
      FROM caja_movimiento m
      JOIN caja_movimiento_detalle d ON d.movimiento_id = m.id
      WHERE ${whereSql}
      GROUP BY d.metodo_pago
      `,
      params,
    );

    const netoPorMetodo: Record<string, number> = {
      EFECTIVO: 0,
      TARJETA: 0,
      TRANSFERENCIA: 0,
      BILLETERA: 0,
      CHEQUE: 0,
      CTA_CORRIENTE: 0,
    };

    for (const r of resumenRows) {
      const k = String(r.metodo);
      if (k in netoPorMetodo) netoPorMetodo[k] = Number(r.total);
    }

    const netoGeneral = Object.values(netoPorMetodo).reduce(
      (a, b) => Number(a) + Number(b),
      0,
    );

    // 7) Facets (para UI: conteos rápidos)
    const facetTipoRows = await this.ds.query(
      `
      SELECT m.tipo, COUNT(*)::int AS cnt
      FROM caja_movimiento m
      WHERE ${whereSql}
      GROUP BY m.tipo
      `,
      params,
    );

    const porTipo = { INGRESO: 0, EGRESO: 0 };
    for (const r of facetTipoRows) {
      const k = String(r.tipo);
      if (k === 'INGRESO' || k === 'EGRESO') porTipo[k] = Number(r.cnt);
    }

    const facetMetodoRows = await this.ds.query(
      `
      SELECT d.metodo_pago AS metodo, COUNT(DISTINCT m.id)::int AS cnt
      FROM caja_movimiento m
      JOIN caja_movimiento_detalle d ON d.movimiento_id = m.id
      WHERE ${whereSql}
      GROUP BY d.metodo_pago
      `,
      params,
    );

    const porMetodo: Record<string, number> = {
      EFECTIVO: 0,
      TARJETA: 0,
      TRANSFERENCIA: 0,
      BILLETERA: 0,
      CHEQUE: 0,
      CTA_CORRIENTE: 0,
    };
    for (const r of facetMetodoRows) {
      const k = String(r.metodo);
      if (k in porMetodo) porMetodo[k] = Number(r.cnt);
    }

    return {
      aperturaId,
      paginacion: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      resumen: {
        netoGeneral: Number(netoGeneral.toFixed(2)),
        netoPorMetodo,
      },
      facets: {
        porTipo,
        porMetodo,
      },
      items,
    };
  }
}

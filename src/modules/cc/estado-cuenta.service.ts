import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryEstadoCuentaDto } from './dto/query-estado-cuenta.dto';

@Injectable()
export class EstadoCuentaService {
  constructor(private readonly ds: DataSource) {}

  /**
   * Estado de cuenta por cliente (por cuenta):
   * - saldo_inicial (antes de 'desde')
   * - movimientos (cargos, pagos, NC, ND) con importe firmado y saldo_corrido
   * - totales por tipo y saldo_final
   *
   * IMPORTANTE:
   * - Ahora TODO está separado por CUENTA (CUENTA1 / CUENTA2).
   * - Este endpoint devuelve UNA cuenta. Para la vista integrada, se arma otro endpoint (o se llama 2 veces y se mergea).
   */
  async estadoCuenta(q: QueryEstadoCuentaDto) {
    const clienteId = q.cliente_id;
    if (!clienteId) throw new BadRequestException('cliente_id requerido');

    // Asumimos que ya agregaste cuenta en el DTO (requerida)
    const cuenta = (q as any).cuenta;
    if (!cuenta)
      throw new BadRequestException('cuenta requerida (CUENTA1/CUENTA2)');

    const order = (q.order ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(Math.max(q.limit ?? 100, 1), 500);
    const offset = (page - 1) * limit;

    // --- SALDO INICIAL (antes de 'desde') --- (filtrado por cuenta)
    let saldoInicial = 0;
    if (q.desde) {
      const desde = new Date(q.desde);
      const sqlSaldo = `
        WITH tot_cargos AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_cargos
          WHERE cliente_id = $1 AND cuenta = $2 AND fecha < $3
        ),
        tot_pagos AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_pagos
          WHERE cliente_id = $1 AND cuenta = $2 AND fecha < $3
        ),
        tot_nc AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_ajustes
          WHERE cliente_id = $1 AND cuenta = $2 AND tipo = 'NC' AND fecha < $3
        ),
        tot_nd AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_ajustes
          WHERE cliente_id = $1 AND cuenta = $2 AND tipo = 'ND' AND fecha < $3
        )
        SELECT
          (SELECT s FROM tot_cargos)
          + (SELECT s FROM tot_nd)
          - (SELECT s FROM tot_pagos)
          - (SELECT s FROM tot_nc) AS saldo_ini;
      `;
      const r = await this.ds.query(sqlSaldo, [clienteId, cuenta, desde]);
      saldoInicial = Number(r?.[0]?.saldo_ini || 0);
    }

    // --- Filtros de rango para movimientos del período --- (por cliente + cuenta)
    const params: any[] = [clienteId, cuenta];
    let p = 3;

    // OJO: acá ya tenemos "mov.cliente_id = $1 AND mov.cuenta = $2"
    const conds: string[] = ['mov.cliente_id = $1', 'mov.cuenta = $2'];

    if (q.desde) {
      conds.push(`mov.fecha >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      conds.push(`mov.fecha < $${p++}`);
      params.push(new Date(q.hasta));
    }
    const whereMov = conds.join(' AND ');

    // Índices paramétricos para saldo inicial / limit / offset
    const siIdx = p++;
    const limitIdx = p++;
    const offsetIdx = p++;

    const sqlMovs = `
      WITH mov AS (
        -- CARGOS (+)
        SELECT
          c.cliente_id,
          c.cuenta,
          c.fecha,
          'CARGO'::text AS tipo,
          c.id::text    AS origen_id,
          COALESCE(c.venta_ref_tipo,'') || ':' || COALESCE(c.venta_ref_id,'') AS ref,
          c.observacion,
          (c.importe)::numeric(18,4) AS importe_signed
        FROM public.cc_cargos c
        WHERE c.cliente_id = $1 AND c.cuenta = $2

        UNION ALL

        -- PAGOS (-)
        SELECT
          p.cliente_id,
          p.cuenta,
          p.fecha,
          'PAGO'::text AS tipo,
          p.id::text AS origen_id,
          COALESCE(p.referencia_externa,'') AS ref,
          p.observacion,
          (-p.importe)::numeric(18,4) AS importe_signed
        FROM public.cc_pagos p
        WHERE p.cliente_id = $1 AND p.cuenta = $2

        UNION ALL

        -- NC (-)
        SELECT
          a.cliente_id,
          a.cuenta,
          a.fecha,
          'NC'::text AS tipo,
          a.id::text AS origen_id,
          COALESCE(a.referencia_externa,'') AS ref,
          a.observacion,
          (-a.importe)::numeric(18,4) AS importe_signed
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta = $2 AND a.tipo = 'NC'

        UNION ALL

        -- ND (+)
        SELECT
          a.cliente_id,
          a.cuenta,
          a.fecha,
          'ND'::text AS tipo,
          a.id::text AS origen_id,
          COALESCE(a.referencia_externa,'') AS ref,
          a.observacion,
          (a.importe)::numeric(18,4) AS importe_signed
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta = $2 AND a.tipo = 'ND'
      ),
      filtrado AS (
        SELECT * FROM mov mov WHERE ${whereMov}
      ),
      ordenado AS (
        SELECT * FROM filtrado
        ORDER BY fecha ${order}, tipo ${order}, origen_id ${order}
      ),
      con_running AS (
        SELECT
          cliente_id, cuenta, fecha, tipo, origen_id, ref, observacion, importe_signed,
          SUM(importe_signed) OVER (
            ORDER BY fecha ${order}, tipo ${order}, origen_id ${order}
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS running_period
        FROM ordenado
      )
      SELECT
        cliente_id, cuenta, fecha, tipo, origen_id, ref, observacion, importe_signed,
        ( $${siIdx}::numeric + running_period )::numeric(18,4) AS saldo_corrido
      FROM con_running
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    // --- Totales del período (footer) --- (filtrado por cuenta)
    const sqlTotales = `
      WITH mov AS (
        SELECT c.fecha, 'CARGO'::text AS tipo, (c.importe)::numeric AS amt
        FROM public.cc_cargos c
        WHERE c.cliente_id = $1 AND c.cuenta = $2

        UNION ALL

        SELECT p.fecha, 'PAGO'::text, (-p.importe)::numeric
        FROM public.cc_pagos p
        WHERE p.cliente_id = $1 AND p.cuenta = $2

        UNION ALL

        SELECT a.fecha, 'NC'::text, (-a.importe)::numeric
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta = $2 AND a.tipo = 'NC'

        UNION ALL

        SELECT a.fecha, 'ND'::text, (a.importe)::numeric
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta = $2 AND a.tipo = 'ND'
      )
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'CARGO' THEN amt ELSE 0 END),0)::numeric(18,4) AS total_cargos,
        COALESCE(SUM(CASE WHEN tipo = 'ND'    THEN amt ELSE 0 END),0)::numeric(18,4) AS total_nd,
        COALESCE(SUM(CASE WHEN tipo = 'PAGO'  THEN -amt ELSE 0 END),0)::numeric(18,4) AS total_pagos,
        COALESCE(SUM(CASE WHEN tipo = 'NC'    THEN -amt ELSE 0 END),0)::numeric(18,4) AS total_nc,
        COALESCE(SUM(amt),0)::numeric(18,4) AS neto_periodo
      FROM mov
      WHERE 1=1
        ${q.desde ? 'AND fecha >= $3' : ''}
        ${q.hasta ? `AND fecha < $${q.desde ? 4 : 3}` : ''};
    `;

    // --- Total filas (paginación) --- (filtrado por cuenta)
    const sqlCount = `
      WITH mov AS (
        SELECT c.fecha
        FROM public.cc_cargos c
        WHERE c.cliente_id = $1 AND c.cuenta = $2

        UNION ALL

        SELECT p.fecha
        FROM public.cc_pagos p
        WHERE p.cliente_id = $1 AND p.cuenta = $2

        UNION ALL

        SELECT a.fecha
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta = $2
      )
      SELECT COUNT(1)::int AS c
      FROM mov
      WHERE 1=1
        ${q.desde ? 'AND fecha >= $3' : ''}
        ${q.hasta ? `AND fecha < $${q.desde ? 4 : 3}` : ''};
    `;

    // --- Ejecutar ---
    const movParams = [...params, saldoInicial, limit, offset];
    const rows = await this.ds.query(sqlMovs, movParams);

    const totParams: any[] = [clienteId, cuenta];
    if (q.desde) totParams.push(new Date(q.desde));
    if (q.hasta) totParams.push(new Date(q.hasta));

    const tot = (await this.ds.query(sqlTotales, totParams))?.[0] ?? {};
    const count = (await this.ds.query(sqlCount, totParams))?.[0]?.c ?? 0;

    const saldoFinal = Number(
      (saldoInicial + Number(tot?.neto_periodo || 0)).toFixed(4),
    );

    return {
      cliente_id: clienteId,
      cuenta,
      rango: {
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        order,
      },
      saldo_inicial: Number(saldoInicial.toFixed(4)),
      movimientos: rows.map((r: any) => ({
        fecha: r.fecha,
        tipo: r.tipo, // CARGO | ND | NC | PAGO
        origen_id: r.origen_id,
        referencia: r.ref,
        observacion: r.observacion,
        importe: Number(Number(r.importe_signed).toFixed(4)),
        saldo_corrido: Number(Number(r.saldo_corrido).toFixed(4)),
      })),
      totales_periodo: {
        total_cargos: Number(tot?.total_cargos || 0),
        total_nd: Number(tot?.total_nd || 0),
        total_pagos: Number(tot?.total_pagos || 0),
        total_nc: Number(tot?.total_nc || 0),
        neto_periodo: Number(tot?.neto_periodo || 0), // cargos+nd - pagos - nc
      },
      saldo_final: saldoFinal,
      pagination: { page, limit, total: Number(count) },
    };
  }
}

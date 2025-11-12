import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryEstadoCuentaDto } from './dto/query-estado-cuenta.dto';

@Injectable()
export class EstadoCuentaService {
  constructor(private readonly ds: DataSource) {}

  /**
   * Estado de cuenta por cliente:
   * - saldo_inicial (antes de 'desde')
   * - movimientos (cargos, pagos C1/C2, NC, ND) con importe firmado y saldo_corrido
   * - totales por tipo y saldo_final
   */
  async estadoCuenta(q: QueryEstadoCuentaDto) {
    const clienteId = q.cliente_id;
    if (!clienteId) throw new BadRequestException('cliente_id requerido');

    const order = (q.order ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(Math.max(q.limit ?? 100, 1), 500);
    const offset = (page - 1) * limit;

    // --- Cálculo de SALDO INICIAL (todo antes de 'desde') ---
    // si no hay 'desde', saldo_inicial = 0 para simplificar el extracto completo
    let saldoInicial = 0;
    if (q.desde) {
      const desde = new Date(q.desde);
      const sqlSaldo = `
        WITH tot_cargos AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_cargos
          WHERE cliente_id = $1 AND fecha < $2
        ),
        tot_pagos AS (
          SELECT COALESCE(SUM(importe_total),0)::numeric AS s
          FROM public.cc_pagos
          WHERE cliente_id = $1 AND fecha < $2
        ),
        tot_nc AS (
          SELECT COALESCE(SUM(monto_total),0)::numeric AS s
          FROM public.cc_ajustes
          WHERE cliente_id = $1 AND tipo = 'NC' AND fecha < $2
        ),
        tot_nd AS (
          SELECT COALESCE(SUM(monto_total),0)::numeric AS s
          FROM public.cc_ajustes
          WHERE cliente_id = $1 AND tipo = 'ND' AND fecha < $2
        )
        SELECT
          (SELECT s FROM tot_cargos)
          + (SELECT s FROM tot_nd)
          - (SELECT s FROM tot_pagos)
          - (SELECT s FROM tot_nc) AS saldo_ini;
      `;
      const r = await this.ds.query(sqlSaldo, [clienteId, desde]);
      saldoInicial = Number(r?.[0]?.saldo_ini || 0);
    }

    // --- Filtros de rango para movimientos en el período ---
    const params: any[] = [clienteId];
    let p = 2;
    const conds: string[] = ['mov.cliente_id = $1'];

    if (q.desde) {
      conds.push(`mov.fecha >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      conds.push(`mov.fecha < $${p++}`);
      params.push(new Date(q.hasta));
    }
    const whereMov = conds.join(' AND ');

    // --- Movimientos unificados con importe firmado ---
    // Convenciones:
    //  - CARGO:        +importe
    //  - ND:           +monto_total
    //  - PAGO_C1/C2:   -importe_total
    //  - NC:           -monto_total
    // Se arma una UNION ALL con una vista "mov(cliente_id, fecha, tipo, origen_id, ref, observacion, importe_signed)"
    const idxLimit = p++;
    const idxOffset = p++;

    const sqlMovs = `
      WITH mov AS (
        -- CARGOS
        SELECT
          c.cliente_id,
          c.fecha,
          'CARGO'::text AS tipo,
          c.id::text    AS origen_id,
          COALESCE(c.venta_ref_tipo,'') || ':' || COALESCE(c.venta_ref_id,'') AS ref,
          c.observacion,
          (c.importe)::numeric(18,4) AS importe_signed
        FROM public.cc_cargos c
        WHERE c.cliente_id = $1

        UNION ALL

       -- PAGOS (Cuenta 1/2)
        SELECT
          p.cliente_id,
          p.fecha,
          CASE WHEN p.cuenta = 'CUENTA1'::cc_pago_cuenta THEN 'PAGO_C1' ELSE 'PAGO_C2' END AS tipo,
          p.id::text AS origen_id,
          COALESCE(p.referencia_externa,'') AS ref,
          p.observacion,
          (-p.importe_total)::numeric(18,4) AS importe_signed
        FROM public.cc_pagos p
        WHERE p.cliente_id = $1


        UNION ALL

        -- NOTAS DE CRÉDITO (NC) => negativo
        SELECT
          a.cliente_id,
          a.fecha,
          'NC'::text AS tipo,
          a.id::text AS origen_id,
          COALESCE(a.referencia_externa,'') AS ref,
          a.observacion,
          (-a.monto_total)::numeric(18,4) AS importe_signed
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.tipo = 'NC'

        UNION ALL

        -- NOTAS DE DÉBITO (ND) => positivo
        SELECT
          a.cliente_id,
          a.fecha,
          'ND'::text AS tipo,
          a.id::text AS origen_id,
          COALESCE(a.referencia_externa,'') AS ref,
          a.observacion,
          (a.monto_total)::numeric(18,4) AS importe_signed
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.tipo = 'ND'
      ),
      filtrado AS (
        SELECT *
        FROM mov
        WHERE ${whereMov}
      ),
      ordenado AS (
        SELECT *
        FROM filtrado
        ORDER BY fecha ${order}, tipo ${order}, origen_id ${order}
      ),
      con_running AS (
        SELECT
          cliente_id, fecha, tipo, origen_id, ref, observacion, importe_signed,
          -- saldo corrido relativo al período (arranca en 0)
          SUM(importe_signed) OVER (
            ORDER BY fecha ${order}, tipo ${order}, origen_id ${order}
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS running_period
        FROM ordenado
      )
      SELECT
        cliente_id,
        fecha,
        tipo,
        origen_id,
        ref,
        observacion,
        importe_signed,
        -- saldo corrido absoluto = saldo_inicial + running_period
        ( $${idxLimit - 1} + running_period )::numeric(18,4) AS saldo_corrido
      FROM con_running
      LIMIT $${idxLimit} OFFSET $${idxOffset};
    `;

    // Totales del período (para footer)
    const sqlTotales = `
      WITH mov AS (
        SELECT c.fecha, 'CARGO'::text AS tipo, (c.importe)::numeric AS amt
        FROM public.cc_cargos c
        WHERE c.cliente_id = $1

        UNION ALL

        SELECT p.fecha,
              CASE WHEN p.cuenta = 'CUENTA1'::cc_pago_cuenta THEN 'PAGO_C1' ELSE 'PAGO_C2' END,
              (-p.importe_total)::numeric
        FROM public.cc_pagos p
        WHERE p.cliente_id = $1

        UNION ALL
        SELECT a.fecha, 'NC', (-a.monto_total)::numeric
        FROM public.cc_ajustes a WHERE a.cliente_id = $1 AND a.tipo = 'NC'

        UNION ALL
        SELECT a.fecha, 'ND', (a.monto_total)::numeric
        FROM public.cc_ajustes a WHERE a.cliente_id = $1 AND a.tipo = 'ND'
      )
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'CARGO'  THEN amt ELSE 0 END),0)::numeric(18,4) AS total_cargos,
        COALESCE(SUM(CASE WHEN tipo = 'ND'     THEN amt ELSE 0 END),0)::numeric(18,4) AS total_nd,
        COALESCE(SUM(CASE WHEN tipo = 'PAGO_C1' THEN -amt ELSE 0 END),0)::numeric(18,4) AS total_pagos_c1,
        COALESCE(SUM(CASE WHEN tipo = 'PAGO_C2' THEN -amt ELSE 0 END),0)::numeric(18,4) AS total_pagos_c2,
        COALESCE(SUM(CASE WHEN tipo = 'NC'     THEN -amt ELSE 0 END),0)::numeric(18,4) AS total_nc,
        COALESCE(SUM(amt),0)::numeric(18,4) AS neto_periodo
      FROM mov
      WHERE 1=1
        ${q.desde ? 'AND fecha >= $2' : ''}
        ${q.hasta ? `AND fecha < $${q.desde ? 3 : 2}` : ''};
    `;

    // Total filas (para paginación)
    const sqlCount = `
      WITH mov AS (
        SELECT c.cliente_id, c.fecha FROM public.cc_cargos c WHERE c.cliente_id = $1
        UNION ALL
        SELECT p.cliente_id, p.fecha FROM public.cc_pagos p WHERE p.cliente_id = $1
        UNION ALL
        SELECT a.cliente_id, a.fecha FROM public.cc_ajustes a WHERE a.cliente_id = $1
      )
      SELECT COUNT(1)::int AS c
      FROM mov
      WHERE 1=1
        ${q.desde ? 'AND fecha >= $2' : ''}
        ${q.hasta ? `AND fecha < $${q.desde ? 3 : 2}` : ''};
    `;

    // --- Ejecutar ---
    const movParams = [...params, saldoInicial, limit, offset]; // ojo: el saldoInicial ocupa el idx (idxLimit-1) en la SELECT
    const rows = await this.ds.query(sqlMovs, movParams);

    const totParams: any[] = [clienteId];
    if (q.desde) totParams.push(new Date(q.desde));
    if (q.hasta) totParams.push(new Date(q.hasta));
    const tot = (await this.ds.query(sqlTotales, totParams))?.[0] ?? {};

    const count = (await this.ds.query(sqlCount, totParams))?.[0]?.c ?? 0;

    const saldoFinal = Number(
      (saldoInicial + Number(tot?.neto_periodo || 0)).toFixed(4),
    );

    return {
      cliente_id: clienteId,
      rango: {
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        order,
      },
      saldo_inicial: Number(saldoInicial.toFixed(4)),
      movimientos: rows.map((r: any) => ({
        fecha: r.fecha,
        tipo: r.tipo, // CARGO | ND | NC | PAGO_C1 | PAGO_C2
        origen_id: r.origen_id,
        referencia: r.ref,
        observacion: r.observacion,
        importe: Number(Number(r.importe_signed).toFixed(4)),
        saldo_corrido: Number(Number(r.saldo_corrido).toFixed(4)),
      })),
      totales_periodo: {
        total_cargos: Number(tot?.total_cargos || 0),
        total_nd: Number(tot?.total_nd || 0),
        total_pagos_c1: Number(tot?.total_pagos_c1 || 0),
        total_pagos_c2: Number(tot?.total_pagos_c2 || 0),
        total_nc: Number(tot?.total_nc || 0),
        neto_periodo: Number(tot?.neto_periodo || 0), // cargos+nd - pagos - nc
      },
      saldo_final: saldoFinal,
      pagination: { page, limit, total: Number(count) },
    };
  }
}

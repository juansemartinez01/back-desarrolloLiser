import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryEstadoCuentaDto } from './dto/query-estado-cuenta.dto';

function pickQueryValue(v: any) {
  // Postman / Express pueden mandar array si el param vino repetido
  if (Array.isArray(v)) return v.length ? v[v.length - 1] : undefined;
  return v;
}

function parseBool(v: any, def = true): boolean {
  v = pickQueryValue(v);

  if (v === true || v === false) return v;
  if (v === null || v === undefined) return def;

  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'si'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;

  return def;
}


@Injectable()
export class EstadoCuentaService {
  constructor(private readonly ds: DataSource) {}

  async estadoCuenta(q: QueryEstadoCuentaDto, includeMovsRaw?: any) {
    const includeMovs = parseBool(
      includeMovsRaw ?? (q as any).include_movimientos,
      true,
    );

    

    const search =
      typeof (q as any).q === 'string' && (q as any).q.trim()
        ? (q as any).q.trim()
        : undefined;

    const tiposRaw: any = (q as any).tipos;
    let tipos: string[] | undefined;
    if (Array.isArray(tiposRaw)) {
      tipos = tiposRaw
        .map((x) => String(x).trim().toUpperCase())
        .filter(Boolean);
    } else if (typeof tiposRaw === 'string' && tiposRaw.trim()) {
      tipos = tiposRaw
        .split(',')
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
    }

    const clienteId = q.cliente_id;
    if (!clienteId) throw new BadRequestException('cliente_id requerido');

    const cuentaParam = String((q as any).cuenta || '').toUpperCase();
    if (!cuentaParam)
      throw new BadRequestException('cuenta requerida (CUENTA1/CUENTA2/AMBAS)');

    // ✅ soporta AMBAS
    const cuentas =
      cuentaParam === 'AMBAS' ? ['CUENTA1', 'CUENTA2'] : [cuentaParam];

    const order = (q.order ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(Math.max(q.limit ?? 100, 1), 500);
    const offset = (page - 1) * limit;

    /**
     * ✅ MUY IMPORTANTE:
     * En tu DB, cuenta es ENUM (cc_pago_cuenta). Hay que castear:
     * - single: $2::cc_pago_cuenta
     * - array:  $2::cc_pago_cuenta[]
     */
    const PG_ENUM_CUENTA = 'cc_pago_cuenta';

    const isAmbas = cuentas.length > 1;

    // -------------------------------------------------------------------------
    // SALDO INICIAL (antes de 'desde') - NO filtra por tipos/q
    // -------------------------------------------------------------------------
    let saldoInicial = 0;
    if (q.desde) {
      const desde = new Date(q.desde);

      const sqlSaldo = isAmbas
        ? `
        WITH tot_cargos AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_cargos
          WHERE cliente_id = $1 AND cuenta = ANY($2::${PG_ENUM_CUENTA}[]) AND fecha < $3
        ),
        tot_pagos AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_pagos
          WHERE cliente_id = $1 AND cuenta = ANY($2::${PG_ENUM_CUENTA}[]) AND fecha < $3
        ),
        tot_nc AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_ajustes
          WHERE cliente_id = $1 AND cuenta = ANY($2::${PG_ENUM_CUENTA}[]) AND tipo = 'NC' AND fecha < $3
        ),
        tot_nd AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_ajustes
          WHERE cliente_id = $1 AND cuenta = ANY($2::${PG_ENUM_CUENTA}[]) AND tipo = 'ND' AND fecha < $3
        )
        SELECT
          (SELECT s FROM tot_cargos)
          + (SELECT s FROM tot_nd)
          - (SELECT s FROM tot_pagos)
          - (SELECT s FROM tot_nc) AS saldo_ini;
      `
        : `
        WITH tot_cargos AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_cargos
          WHERE cliente_id = $1 AND cuenta = $2::${PG_ENUM_CUENTA} AND fecha < $3
        ),
        tot_pagos AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_pagos
          WHERE cliente_id = $1 AND cuenta = $2::${PG_ENUM_CUENTA} AND fecha < $3
        ),
        tot_nc AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_ajustes
          WHERE cliente_id = $1 AND cuenta = $2::${PG_ENUM_CUENTA} AND tipo = 'NC' AND fecha < $3
        ),
        tot_nd AS (
          SELECT COALESCE(SUM(importe),0)::numeric AS s
          FROM public.cc_ajustes
          WHERE cliente_id = $1 AND cuenta = $2::${PG_ENUM_CUENTA} AND tipo = 'ND' AND fecha < $3
        )
        SELECT
          (SELECT s FROM tot_cargos)
          + (SELECT s FROM tot_nd)
          - (SELECT s FROM tot_pagos)
          - (SELECT s FROM tot_nc) AS saldo_ini;
      `;

      const r = await this.ds.query(sqlSaldo, [
        clienteId,
        isAmbas ? cuentas : cuentas[0],
        desde,
      ]);
      saldoInicial = Number(r?.[0]?.saldo_ini || 0);
    }

    // -------------------------------------------------------------------------
    // WHERE base para MOVIMIENTOS (cliente+cuenta(s)+desde/hasta)
    // -------------------------------------------------------------------------
    const params: any[] = [clienteId, isAmbas ? cuentas : cuentas[0]];
    let p = 3;

    const conds: string[] = [
      'mov.cliente_id = $1',
      isAmbas
        ? `mov.cuenta = ANY($2::${PG_ENUM_CUENTA}[])`
        : `mov.cuenta = $2::${PG_ENUM_CUENTA}`,
    ];

    if (q.desde) {
      conds.push(`mov.fecha >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      conds.push(`mov.fecha < $${p++}`);
      params.push(new Date(q.hasta));
    }
    const whereMov = conds.join(' AND ');

    // índices paramétricos para sqlMovs
    const siIdx = p++;
    const limitIdx = p++;
    const offsetIdx = p++;

    // extras para listado
    const extraCondsMovs: string[] = [];
    const extraParamsMovs: any[] = [];
    let pxMovs = offsetIdx + 1;

    if (tipos?.length) {
      extraCondsMovs.push(`mov.tipo = ANY($${pxMovs}::text[])`);
      extraParamsMovs.push(tipos);
      pxMovs++;
    }

    if (search) {
      extraCondsMovs.push(
        `(mov.ref ILIKE $${pxMovs} OR mov.observacion ILIKE $${pxMovs})`,
      );
      extraParamsMovs.push(`%${search}%`);
      pxMovs++;
    }

    const whereExtraMovs = extraCondsMovs.length
      ? ` AND ${extraCondsMovs.join(' AND ')}`
      : '';

    // extras para count
    const extraCondsCount: string[] = [];
    const extraParamsCount: any[] = [];
    let pxCount = params.length + 1;

    if (tipos?.length) {
      extraCondsCount.push(`mov.tipo = ANY($${pxCount}::text[])`);
      extraParamsCount.push(tipos);
      pxCount++;
    }

    if (search) {
      extraCondsCount.push(
        `(mov.ref ILIKE $${pxCount} OR mov.observacion ILIKE $${pxCount})`,
      );
      extraParamsCount.push(`%${search}%`);
      pxCount++;
    }

    const whereExtraCount = extraCondsCount.length
      ? ` AND ${extraCondsCount.join(' AND ')}`
      : '';

    // -------------------------------------------------------------------------
    // SQL MOVS / TOTALES / COUNT
    // -------------------------------------------------------------------------
    const cuentaFilterSql = isAmbas
      ? `= ANY($2::${PG_ENUM_CUENTA}[])`
      : `= $2::${PG_ENUM_CUENTA}`;

    const sqlMovs = `
      WITH mov AS (
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
        WHERE c.cliente_id = $1 AND c.cuenta ${cuentaFilterSql}

        UNION ALL

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
        WHERE p.cliente_id = $1 AND p.cuenta ${cuentaFilterSql}

        UNION ALL

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
        WHERE a.cliente_id = $1 AND a.cuenta ${cuentaFilterSql} AND a.tipo = 'NC'

        UNION ALL

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
        WHERE a.cliente_id = $1 AND a.cuenta ${cuentaFilterSql} AND a.tipo = 'ND'
      ),
      filtrado AS (
        SELECT * FROM mov mov
        WHERE ${whereMov}${whereExtraMovs}
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

    const sqlTotales = `
      WITH mov AS (
        SELECT c.fecha, 'CARGO'::text AS tipo, (c.importe)::numeric AS amt
        FROM public.cc_cargos c
        WHERE c.cliente_id = $1 AND c.cuenta ${cuentaFilterSql}

        UNION ALL

        SELECT p.fecha, 'PAGO'::text, (-p.importe)::numeric
        FROM public.cc_pagos p
        WHERE p.cliente_id = $1 AND p.cuenta ${cuentaFilterSql}

        UNION ALL

        SELECT a.fecha, 'NC'::text, (-a.importe)::numeric
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta ${cuentaFilterSql} AND a.tipo = 'NC'

        UNION ALL

        SELECT a.fecha, 'ND'::text, (a.importe)::numeric
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta ${cuentaFilterSql} AND a.tipo = 'ND'
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

    const sqlCountMovs = `
      WITH mov AS (
        SELECT c.cliente_id, c.cuenta, c.fecha, 'CARGO'::text AS tipo,
               COALESCE(c.venta_ref_tipo,'') || ':' || COALESCE(c.venta_ref_id,'') AS ref,
               c.observacion
        FROM public.cc_cargos c
        WHERE c.cliente_id = $1 AND c.cuenta ${cuentaFilterSql}

        UNION ALL

        SELECT p.cliente_id, p.cuenta, p.fecha, 'PAGO'::text AS tipo,
               COALESCE(p.referencia_externa,'') AS ref,
               p.observacion
        FROM public.cc_pagos p
        WHERE p.cliente_id = $1 AND p.cuenta ${cuentaFilterSql}

        UNION ALL

        SELECT a.cliente_id, a.cuenta, a.fecha, 'NC'::text AS tipo,
               COALESCE(a.referencia_externa,'') AS ref,
               a.observacion
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta ${cuentaFilterSql} AND a.tipo = 'NC'

        UNION ALL

        SELECT a.cliente_id, a.cuenta, a.fecha, 'ND'::text AS tipo,
               COALESCE(a.referencia_externa,'') AS ref,
               a.observacion
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta ${cuentaFilterSql} AND a.tipo = 'ND'
      )
      SELECT COUNT(1)::int AS c
      FROM mov mov
      WHERE ${whereMov}${whereExtraCount};
    `;

    // -------------------------------------------------------------------------
    // EJECUTAR (totales siempre; movs/count sólo si includeMovs)
    // -------------------------------------------------------------------------
    const totParams: any[] = [clienteId, isAmbas ? cuentas : cuentas[0]];
    if (q.desde) totParams.push(new Date(q.desde));
    if (q.hasta) totParams.push(new Date(q.hasta));

    const tot = (await this.ds.query(sqlTotales, totParams))?.[0] ?? {};

    const saldoFinal = Number(
      (saldoInicial + Number(tot?.neto_periodo || 0)).toFixed(4),
    );

    let rows: any[] = [];
    let countMovs = 0;

    if (includeMovs) {
      const movParams = [
        ...params,
        saldoInicial,
        limit,
        offset,
        ...extraParamsMovs,
      ];
      rows = await this.ds.query(sqlMovs, movParams);

      countMovs =
        (
          await this.ds.query(sqlCountMovs, [...params, ...extraParamsCount])
        )?.[0]?.c ?? 0;
    }

    return {
      cliente_id: clienteId,
      cuenta: cuentaParam, // CUENTA1 | CUENTA2 | AMBAS
      rango: {
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        order,
      },
      saldo_inicial: Number(saldoInicial.toFixed(4)),
      movimientos: rows.map((r: any) => ({
        cuenta: String(r.cuenta ?? '').toUpperCase(), // 👈 NUEVO (CUENTA1 / CUENTA2)
        fecha: r.fecha,
        tipo: r.tipo,
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
        neto_periodo: Number(tot?.neto_periodo || 0),
      },
      saldo_final: saldoFinal,
      pagination: { page, limit, total: Number(countMovs) },
    };
  }
}

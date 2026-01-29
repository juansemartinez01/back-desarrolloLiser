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
   *
   * NUEVO:
   * - include_movimientos=false => no trae movimientos (pero totales/saldos siguen completos del período)
   * - tipos=CARGO,PAGO,NC,ND => filtra SOLO el listado de movimientos + su paginación (totales/saldo_final no cambian)
   * - q=texto => filtra SOLO el listado (ref/observacion)
   */
  async estadoCuenta(q: QueryEstadoCuentaDto) {
    // -------------------------------------------------------------------------
    // Normalizar query params (Postman suele mandar strings)
    // -------------------------------------------------------------------------
    const includeMovs = q.include_movimientos ?? true;


    const search =
      typeof (q as any).q === 'string' && (q as any).q.trim()
        ? (q as any).q.trim()
        : undefined;

    const tiposRaw: any = (q as any).tipos;
    let tipos: string[] | undefined;
    if (Array.isArray(tiposRaw)) {
      tipos = tiposRaw.map((x) => String(x).trim()).filter(Boolean);
    } else if (typeof tiposRaw === 'string' && tiposRaw.trim()) {
      tipos = tiposRaw
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }

    const clienteId = q.cliente_id;
    if (!clienteId) throw new BadRequestException('cliente_id requerido');

    // Cuenta requerida (CUENTA1/CUENTA2)
    const cuenta = (q as any).cuenta;
    if (!cuenta)
      throw new BadRequestException('cuenta requerida (CUENTA1/CUENTA2)');

    const order = (q.order ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(Math.max(q.limit ?? 100, 1), 500);
    const offset = (page - 1) * limit;

    // -------------------------------------------------------------------------
    // SALDO INICIAL (antes de 'desde') - siempre por período completo
    // (NO se filtra por tipos/q)
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // Filtros base del período para movimientos (cliente+cuenta+desde/hasta)
    // Estos filtros aplican a:
    // - movimientos (si includeMovs=true)
    // - count de movimientos (paginación)
    // NO aplican a totales_periodo ni saldo_final
    // -------------------------------------------------------------------------
    const params: any[] = [clienteId, cuenta];
    let p = 3;

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

    // -------------------------------------------------------------------------
    // Índices paramétricos para sqlMovs: saldoInicial/limit/offset
    // -------------------------------------------------------------------------
    const siIdx = p++;
    const limitIdx = p++;
    const offsetIdx = p++;

    // -------------------------------------------------------------------------
    // whereExtra para sqlMovs (arranca DESPUÉS de offsetIdx)
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // whereExtra para sqlCountMovs (arranca DESPUÉS de params base: cliente/cuenta/desde/hasta)
    // OJO: acá NO existen saldoInicial/limit/offset, por eso es otro numerador.
    // -------------------------------------------------------------------------
    const extraCondsCount: string[] = [];
    const extraParamsCount: any[] = [];
    let pxCount = p; // 👈 p ya quedó apuntando "después de hasta" (y después de si/limit/offset en el numerador original)

    // PERO para COUNT queremos numerar desde (params.length + 1), NO desde p.
    // params.length refleja: [clienteId, cuenta, (desde?), (hasta?)]
    pxCount = params.length + 1;

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
    // MOVIMIENTOS (filtrables)
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // TOTALES DEL PERÍODO (NO se filtran por tipos/q; solo por cliente/cuenta/desde/hasta)
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // COUNT de movimientos (para paginación del listado) - SÍ aplica filtros tipos/q
    // (usa whereExtraCount para no romper numeración de params)
    // -------------------------------------------------------------------------
    const sqlCountMovs = `
      WITH mov AS (
        SELECT
          c.cliente_id,
          c.cuenta,
          c.fecha,
          'CARGO'::text AS tipo,
          COALESCE(c.venta_ref_tipo,'') || ':' || COALESCE(c.venta_ref_id,'') AS ref,
          c.observacion
        FROM public.cc_cargos c
        WHERE c.cliente_id = $1 AND c.cuenta = $2

        UNION ALL

        SELECT
          p.cliente_id,
          p.cuenta,
          p.fecha,
          'PAGO'::text AS tipo,
          COALESCE(p.referencia_externa,'') AS ref,
          p.observacion
        FROM public.cc_pagos p
        WHERE p.cliente_id = $1 AND p.cuenta = $2

        UNION ALL

        SELECT
          a.cliente_id,
          a.cuenta,
          a.fecha,
          'NC'::text AS tipo,
          COALESCE(a.referencia_externa,'') AS ref,
          a.observacion
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta = $2 AND a.tipo = 'NC'

        UNION ALL

        SELECT
          a.cliente_id,
          a.cuenta,
          a.fecha,
          'ND'::text AS tipo,
          COALESCE(a.referencia_externa,'') AS ref,
          a.observacion
        FROM public.cc_ajustes a
        WHERE a.cliente_id = $1 AND a.cuenta = $2 AND a.tipo = 'ND'
      )
      SELECT COUNT(1)::int AS c
      FROM mov mov
      WHERE ${whereMov}${whereExtraCount};
    `;

    // -------------------------------------------------------------------------
    // EJECUTAR
    // -------------------------------------------------------------------------
    const totParams: any[] = [clienteId, cuenta];
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
      pagination: { page, limit, total: Number(countMovs) },
    };
  }
}

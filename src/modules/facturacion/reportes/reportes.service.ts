import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  QueryLibroIvaDto,
  QueryDashboardIvaDto,
} from './dto/query-libro-iva.dto';

function fx4(n: any) {
  return Number(Number(n || 0).toFixed(4));
}
const AFIP_ALIC_MAP = [
  { keyN: 'neto_0', keyI: null, label: '0%' },
  { keyN: 'neto_025', keyI: 'iva_025', label: '2.5%' },
  { keyN: 'neto_05', keyI: 'iva_05', label: '5%' },
  { keyN: 'neto_105', keyI: 'iva_105', label: '10.5%' },
  { keyN: 'neto_21', keyI: 'iva_21', label: '21%' },
  { keyN: 'neto_27', keyI: 'iva_27', label: '27%' },
];

@Injectable()
export class ReportesService {
  constructor(private readonly ds: DataSource) {}

  // =======================
  // == LIBRO IVA VENTAS  ==
  // =======================
  async libroIvaVentas(q: QueryLibroIvaDto) {
    if (!q.desde || !q.hasta)
      throw new BadRequestException('desde y hasta requeridos');

    const conds: string[] = ['f.fecha >= $1', 'f.fecha < $2'];
    const params: any[] = [new Date(q.desde), new Date(q.hasta)];
    let p = 3;

    if (q.factura_tipo) {
      conds.push(`f.factura_tipo = $${p++}`);
      params.push(q.factura_tipo);
    }
    if (q.punto_venta) {
      conds.push(`f.punto_venta = $${p++}`);
      params.push(q.punto_venta);
    }
    if (q.cond_iva_receptor) {
      conds.push(`f.cond_iva_receptor = $${p++}`);
      params.push(q.cond_iva_receptor);
    }
    if (q.doc_tipo) {
      conds.push(`f.doc_tipo = $${p++}`);
      params.push(q.doc_tipo);
    }
    if (q.include_test === false) {
      conds.push(`COALESCE(f.test,false) = false`);
    }

    const where = conds.join(' AND ');

    const baseSql = `
      SELECT
        f.id, f.fecha, f.factura_tipo, f.punto_venta, f.nro_comprobante,
        f.doc_tipo, f.doc_nro, f.razon_social_receptor, f.cond_iva_receptor,
        f.importe_total, f.importe_no_gravado, f.importe_exento, f.importe_tributos, f.importe_iva, f.importe_neto,
        f.neto_0, f.neto_025, f.iva_025, f.neto_05, f.iva_05, f.neto_105, f.iva_105, f.neto_21, f.iva_21, f.neto_27, f.iva_27
      FROM public.fac_facturas f
      WHERE ${where}
      ORDER BY f.fecha ASC, f.factura_tipo ASC, f.punto_venta ASC, f.nro_comprobante ASC
    `;

    const rows: any[] = await this.ds.query(baseSql, params);

    // JSON directo
    if ((q.formato ?? 'json') === 'json') {
      // paginar opcional
      const page = Math.max(1, Number(q.page ?? 1));
      const limit = Math.min(Math.max(Number(q.limit ?? 500), 1), 2000);
      const offset = (page - 1) * limit;
      const data = rows.slice(offset, offset + limit);
      return { data, total: rows.length, page, limit };
    }

    // TXT AFIP-like: 2 archivos: ventas.txt + alicuotas_ventas.txt (en un JSON)
    const linesVenta: string[] = [];
    const linesAli: string[] = [];

    for (const r of rows) {
      const fecha = new Date(r.fecha);
      const y = fecha.getUTCFullYear();
      const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
      const d = String(fecha.getUTCDate()).padStart(2, '0');
      const yyyymmdd = `${y}${m}${d}`;

      // línea de ventas (campos mínimos útiles para libro IVA digital)
      // (Ajustá posiciones si necesitás esquema exacto de AFIP)
      const lineaVenta = [
        yyyymmdd, // Fecha
        r.factura_tipo, // Tipo
        r.punto_venta, // PV
        r.nro_comprobante, // Número
        r.doc_tipo, // Doc Tipo
        r.doc_nro, // Doc Nro
        (r.razon_social_receptor || '').substring(0, 200), // Nombre
        fx4(r.importe_total).toFixed(2),
        fx4(r.importe_neto).toFixed(2),
        fx4(r.importe_iva).toFixed(2),
        fx4(r.importe_exento).toFixed(2),
        fx4(r.importe_no_gravado).toFixed(2),
        fx4(r.importe_tributos).toFixed(2),
      ].join('|');

      linesVenta.push(lineaVenta);

      // líneas de alícuotas por cada base > 0
      for (const a of AFIP_ALIC_MAP) {
        const base = Number(r[a.keyN] || 0);
        const iva = a.keyI ? Number(r[a.keyI] || 0) : 0;
        if (base > 0 || iva > 0) {
          const lineaAli = [
            r.factura_tipo,
            r.punto_venta,
            r.nro_comprobante,
            a.label, // etiqueta legible
            fx4(base).toFixed(2), // Base
            fx4(iva).toFixed(2), // IVA
          ].join('|');
          linesAli.push(lineaAli);
        }
      }
    }

    return {
      txt_ventas: linesVenta.join('\n'),
      txt_alicuotas_ventas: linesAli.join('\n'),
      cantidad_comprobantes: rows.length,
    };
  }

  // =======================
  // == LIBRO IVA COMPRAS ==
  // =======================
  async libroIvaCompras(q: QueryLibroIvaDto) {
    if (!q.desde || !q.hasta)
      throw new BadRequestException('desde y hasta requeridos');

    const conds: string[] = ['c.fecha_emision >= $1', 'c.fecha_emision < $2'];
    const params: any[] = [
      Number(q.desde.replaceAll('-', '')),
      Number(q.hasta.replaceAll('-', '')),
    ];
    let p = 3;

    if (q.factura_tipo) {
      conds.push(`c.comprobante_tipo = $${p++}`);
      params.push(q.factura_tipo);
    }
    if (q.punto_venta) {
      conds.push(`c.punto_venta = $${p++}`);
      params.push(q.punto_venta);
    }
    if (q.doc_tipo_vendedor) {
      conds.push(`c.doc_tipo_vendedor = $${p++}`);
      params.push(q.doc_tipo_vendedor);
    }
    if (q.doc_nro_vendedor) {
      conds.push(`c.doc_nro_vendedor = $${p++}`);
      params.push(q.doc_nro_vendedor);
    }

    const where = conds.join(' AND ');

    const baseSql = `
      SELECT
        c.id, c.fecha_emision, c.comprobante_tipo, c.punto_venta, c.nro_comprobante, c.cae,
        c.doc_tipo_vendedor, c.doc_nro_vendedor, c.nombre_vendedor,
        c.importe_total, c.importe_no_gravado, c.importe_exento, c.percep_iva, c.percep_otros_nacionales,
        c.percep_iibb, c.percep_municipales, c.impuestos_internos, c.importe_iva, c.importe_neto,
        c.neto_0, c.neto_025, c.iva_025, c.neto_05, c.iva_05, c.neto_105, c.iva_105, c.neto_21, c.iva_21, c.neto_27, c.iva_27,
        c.otros_tributos
      FROM public.fac_compras c
      WHERE ${where}
      ORDER BY c.fecha_emision ASC, c.comprobante_tipo ASC, c.punto_venta ASC, c.nro_comprobante ASC
    `;

    const rows: any[] = await this.ds.query(baseSql, params);

    if ((q.formato ?? 'json') === 'json') {
      const page = Math.max(1, Number(q.page ?? 1));
      const limit = Math.min(Math.max(Number(q.limit ?? 500), 1), 2000);
      const offset = (page - 1) * limit;
      const data = rows.slice(offset, offset + limit);
      return { data, total: rows.length, page, limit };
    }

    // TXT AFIP-like: 2 archivos: compras.txt + alicuotas_compras.txt
    const linesCompra: string[] = [];
    const linesAli: string[] = [];

    for (const r of rows) {
      // fecha_emision ya viene YYYYMMDD (int)
      const yyyymmdd = String(r.fecha_emision);

      const lineaCompra = [
        yyyymmdd,
        r.comprobante_tipo,
        r.punto_venta,
        r.nro_comprobante,
        r.doc_tipo_vendedor,
        r.doc_nro_vendedor,
        (r.nombre_vendedor || '').substring(0, 200),
        fx4(r.importe_total).toFixed(2),
        fx4(r.importe_neto).toFixed(2),
        fx4(r.importe_iva).toFixed(2),
        fx4(r.importe_exento).toFixed(2),
        fx4(r.importe_no_gravado).toFixed(2),
        fx4(r.impuestos_internos).toFixed(2),
        fx4(r.percep_iva).toFixed(2),
        fx4(r.percep_iibb).toFixed(2),
        fx4(r.percep_municipales).toFixed(2),
        fx4(r.percep_otros_nacionales).toFixed(2),
        fx4(r.otros_tributos).toFixed(2),
      ].join('|');

      linesCompra.push(lineaCompra);

      for (const a of AFIP_ALIC_MAP) {
        const base = Number(r[a.keyN] || 0);
        const iva = a.keyI ? Number(r[a.keyI] || 0) : 0;
        if (base > 0 || iva > 0) {
          const lineaAli = [
            r.comprobante_tipo,
            r.punto_venta,
            r.nro_comprobante,
            a.label,
            fx4(base).toFixed(2),
            fx4(iva).toFixed(2),
          ].join('|');
          linesAli.push(lineaAli);
        }
      }
    }

    return {
      txt_compras: linesCompra.join('\n'),
      txt_alicuotas_compras: linesAli.join('\n'),
      cantidad_comprobantes: rows.length,
    };
  }

  // =========================
  // == DASHBOARD CONSOLID. ==
  // =========================
  async dashboardIva(q: QueryDashboardIvaDto) {
    if (!q.desde || !q.hasta)
      throw new BadRequestException('desde y hasta requeridos');
    const d1 = new Date(q.desde),
      d2 = new Date(q.hasta);

    // Ventas: totales y por alícuota
    const sqlV = `
      SELECT
        COALESCE(SUM(importe_total),0)::numeric AS total,
        COALESCE(SUM(importe_neto),0)::numeric AS neto,
        COALESCE(SUM(importe_iva),0)::numeric AS iva,
        COALESCE(SUM(importe_exento),0)::numeric AS exento,
        COALESCE(SUM(importe_no_gravado),0)::numeric AS no_gravado,
        COALESCE(SUM(importe_tributos),0)::numeric AS tributos,
        COALESCE(SUM(neto_0),0)::numeric    AS neto_0,
        COALESCE(SUM(neto_025),0)::numeric  AS neto_025,
        COALESCE(SUM(iva_025),0)::numeric   AS iva_025,
        COALESCE(SUM(neto_05),0)::numeric   AS neto_05,
        COALESCE(SUM(iva_05),0)::numeric    AS iva_05,
        COALESCE(SUM(neto_105),0)::numeric  AS neto_105,
        COALESCE(SUM(iva_105),0)::numeric   AS iva_105,
        COALESCE(SUM(neto_21),0)::numeric   AS neto_21,
        COALESCE(SUM(iva_21),0)::numeric    AS iva_21,
        COALESCE(SUM(neto_27),0)::numeric   AS neto_27,
        COALESCE(SUM(iva_27),0)::numeric    AS iva_27
      FROM public.fac_facturas
      WHERE fecha >= $1 AND fecha < $2;
    `;
    // Compras: totales y por alícuota
    const sqlC = `
      SELECT
        COALESCE(SUM(importe_total),0)::numeric AS total,
        COALESCE(SUM(importe_neto),0)::numeric AS neto,
        COALESCE(SUM(importe_iva),0)::numeric AS iva,
        COALESCE(SUM(importe_exento),0)::numeric AS exento,
        COALESCE(SUM(importe_no_gravado),0)::numeric AS no_gravado,
        COALESCE(SUM(impuestos_internos),0)::numeric AS imp_int,
        COALESCE(SUM(percep_iva),0)::numeric AS percep_iva,
        COALESCE(SUM(percep_iibb),0)::numeric AS percep_iibb,
        COALESCE(SUM(percep_municipales),0)::numeric AS percep_muni,
        COALESCE(SUM(percep_otros_nacionales),0)::numeric AS percep_otros,
        COALESCE(SUM(otros_tributos),0)::numeric AS otros_trib,
        COALESCE(SUM(neto_0),0)::numeric    AS neto_0,
        COALESCE(SUM(neto_025),0)::numeric  AS neto_025,
        COALESCE(SUM(iva_025),0)::numeric   AS iva_025,
        COALESCE(SUM(neto_05),0)::numeric   AS neto_05,
        COALESCE(SUM(iva_05),0)::numeric    AS iva_05,
        COALESCE(SUM(neto_105),0)::numeric  AS neto_105,
        COALESCE(SUM(iva_105),0)::numeric   AS iva_105,
        COALESCE(SUM(neto_21),0)::numeric   AS neto_21,
        COALESCE(SUM(iva_21),0)::numeric    AS iva_21,
        COALESCE(SUM(neto_27),0)::numeric   AS neto_27,
        COALESCE(SUM(iva_27),0)::numeric    AS iva_27
      FROM public.fac_compras
      WHERE (to_timestamp(fecha_emision::text, 'YYYYMMDD'))::date >= $1
        AND (to_timestamp(fecha_emision::text, 'YYYYMMDD'))::date < $2;
    `;

    const [v, c] = await Promise.all([
      this.ds.query(sqlV, [d1, d2]).then((r) => r?.[0] || {}),
      this.ds.query(sqlC, [d1, d2]).then((r) => r?.[0] || {}),
    ]);

    const ventas = {
      total: fx4(v.total),
      neto: fx4(v.neto),
      iva: fx4(v.iva),
      exento: fx4(v.exento),
      no_gravado: fx4(v.no_gravado),
      tributos: fx4(v.tributos),
      alicuotas: {
        '0': { neto: fx4(v.neto_0), iva: 0 },
        '2.5': { neto: fx4(v.neto_025), iva: fx4(v.iva_025) },
        '5': { neto: fx4(v.neto_05), iva: fx4(v.iva_05) },
        '10.5': { neto: fx4(v.neto_105), iva: fx4(v.iva_105) },
        '21': { neto: fx4(v.neto_21), iva: fx4(v.iva_21) },
        '27': { neto: fx4(v.neto_27), iva: fx4(v.iva_27) },
      },
    };

    const compras = {
      total: fx4(c.total),
      neto: fx4(c.neto),
      iva: fx4(c.iva),
      exento: fx4(c.exento),
      no_gravado: fx4(c.no_gravado),
      imp_int: fx4(c.imp_int),
      percepciones: {
        iva: fx4(c.percep_iva),
        iibb: fx4(c.percep_iibb),
        municipales: fx4(c.percep_muni),
        otros_nacionales: fx4(c.percep_otros),
      },
      otros_tributos: fx4(c.otros_trib),
      alicuotas: {
        '0': { neto: fx4(c.neto_0), iva: 0 },
        '2.5': { neto: fx4(c.neto_025), iva: fx4(c.iva_025) },
        '5': { neto: fx4(c.neto_05), iva: fx4(c.iva_05) },
        '10.5': { neto: fx4(c.neto_105), iva: fx4(c.iva_105) },
        '21': { neto: fx4(c.neto_21), iva: fx4(c.iva_21) },
        '27': { neto: fx4(c.neto_27), iva: fx4(c.iva_27) },
      },
    };

    // Neto técnico orientativo (no es liquidación): IVA ventas - IVA compras (+/- percepciones si quisieras)
    const iva_tecnico = fx4(ventas.iva - compras.iva);

    return {
      rango: { desde: q.desde, hasta: q.hasta },
      ventas,
      compras,
      iva_tecnico,
    };
  }
}

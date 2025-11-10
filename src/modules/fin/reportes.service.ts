import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const to4 = (n: number | string) => Number(n).toFixed(4);

@Injectable()
export class ReportesFinService {
  constructor(private readonly ds: DataSource) {}

  // Saldos por proveedor (liquidaciones CONFIRMADAS - pagos REGISTRADOS aplicados)
  async saldosPorProveedor() {
    const rows = await this.ds.query(`
      WITH liq AS (
        SELECT proveedor_id, COALESCE(SUM(total_monto),0)::numeric AS total_liq
        FROM fin_liquidaciones
        WHERE estado = 'CONFIRMADA'
        GROUP BY proveedor_id
      ),
      pag AS (
        SELECT p.proveedor_id, COALESCE(SUM(a.monto_aplicado),0)::numeric AS total_pagado
        FROM fin_pago_aplic a
        JOIN fin_pagos p ON p.id = a.pago_id AND p.estado = 'REGISTRADO'
        GROUP BY p.proveedor_id
      )
      SELECT COALESCE(l.proveedor_id, p.proveedor_id) AS proveedor_id,
             COALESCE(l.total_liq, 0)::numeric(18,4) AS total_liquidado,
             COALESCE(p.total_pagado, 0)::numeric(18,4) AS total_pagado,
             (COALESCE(l.total_liq,0) - COALESCE(p.total_pagado,0))::numeric(18,4) AS saldo
      FROM liq l
      FULL JOIN pag p ON p.proveedor_id = l.proveedor_id
      ORDER BY proveedor_id ASC;
    `);
    return { data: rows };
  }

  // Estado detallado de un proveedor
  async estadoProveedor(proveedorId: number) {
    // Liquidaciones con saldo
    const liqs = await this.ds.query(
      `
      SELECT l.id, l.fecha, l.total_monto,
             (l.total_monto - COALESCE((
                SELECT SUM(a.monto_aplicado) FROM fin_pago_aplic a
                JOIN fin_pagos p ON p.id = a.pago_id AND p.estado = 'REGISTRADO'
                WHERE a.liquidacion_id = l.id
              ),0))::numeric(18,4) AS saldo
      FROM fin_liquidaciones l
      WHERE l.proveedor_id = $1 AND l.estado = 'CONFIRMADA'
      ORDER BY l.fecha ASC, l.created_at ASC
      `,
      [proveedorId],
    );

    // Pagos con saldo sin aplicar
    const pags = await this.ds.query(
      `
      SELECT p.id, p.fecha, p.monto_total,
             (p.monto_total - COALESCE((
                SELECT SUM(a.monto_aplicado) FROM fin_pago_aplic a
                WHERE a.pago_id = p.id
              ),0))::numeric(18,4) AS saldo
      FROM fin_pagos p
      WHERE p.proveedor_id = $1 AND p.estado = 'REGISTRADO'
      ORDER BY p.fecha ASC, p.created_at ASC
      `,
      [proveedorId],
    );

    const totalLiq = Number(
      liqs.reduce((s: any, l: any) => s + Number(l.total_monto), 0).toFixed(4),
    );
    const totalPag = Number(
      pags.reduce((s: any, p: any) => s + Number(p.monto_total), 0).toFixed(4),
    );
    const totalSaldoLiq = Number(
      liqs.reduce((s: any, l: any) => s + Number(l.saldo), 0).toFixed(4),
    );
    const totalSaldoPag = Number(
      pags.reduce((s: any, p: any) => s + Number(p.saldo), 0).toFixed(4),
    );

    return {
      proveedor_id: proveedorId,
      liquidaciones: liqs,
      pagos: pags,
      totales: {
        total_liquidado: to4(totalLiq),
        total_pagado: to4(totalPag),
        saldo_liquidaciones: to4(totalSaldoLiq),
        saldo_pagos_sin_aplicar: to4(totalSaldoPag),
        saldo_neto: to4(totalLiq - (totalPag - totalSaldoPag)), // doc view; el saldo neto a pagar = saldo_liquidaciones - saldo_pagos_sin_aplicar?
      },
    };
  }
}

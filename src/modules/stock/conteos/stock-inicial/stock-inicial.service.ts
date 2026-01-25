import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryStockInicialDto } from './dto/query-stock-inicial.dto';

type Row = {
  producto_id: number;
  nombre: string;
  almacen_id: number | null;
  cantidad: string | null;
};

function toNumber(n: any): number {
  const v = typeof n === 'string' ? Number(n) : Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}

@Injectable()
export class StockInicialService {
  constructor(private readonly ds: DataSource) {}

  private async hoyAR(qr: any): Promise<string> {
    const rows = await qr.query(`
      SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia
    `);
    return rows[0].dia; // 'YYYY-MM-DD'
  }

  /**
   * Devuelve el "stock inicial" de un día operativo.
   * Regla:
   * - Si existe snapshot exacto para dia -> usarlo
   * - Si no existe -> NO inventar (queda vacío y total=0), para mantener tu UI coherente.
   *
   * Si preferís "último snapshot anterior", te lo adapto (es 1 cambio de SQL).
   */
  async obtenerStockInicialFormateado(q: QueryStockInicialDto) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();

    try {
      const dia = q.dia?.slice(0, 10) ?? (await this.hoyAR(qr));

      /**
       * IMPORTANTE:
       * Cambiá public.stk_productos por el nombre real de tu tabla de productos.
       * Campos esperados: p.id, p.nombre
       */
      const rows: Row[] = await qr.query(
        `
        SELECT
          p.id AS producto_id,
          p.nombre AS nombre,
          sid.almacen_id AS almacen_id,
          sid.cantidad_inicial AS cantidad
        FROM public.stk_productos p
        LEFT JOIN public.stk_stock_inicial_diario sid
          ON sid.producto_id = p.id
         AND sid.dia = $1::date
        ORDER BY p.id ASC, sid.almacen_id ASC
        `,
        [dia],
      );

      // Agrupar al formato requerido
      const map = new Map<
        number,
        {
          producto_id: number;
          nombre: string;
          almacenes: Array<{ almacen_id: number; cantidad: number }>;
          total: number;
        }
      >();

      for (const r of rows) {
        const pid = Number(r.producto_id);
        if (!map.has(pid)) {
          map.set(pid, {
            producto_id: pid,
            nombre: r.nombre,
            almacenes: [],
            total: 0,
          });
        }

        const item = map.get(pid)!;

        if (r.almacen_id != null && r.cantidad != null) {
          const cantidadNum = toNumber(r.cantidad);

          // Si querés incluir 0 explícitos en almacenes, sacá este if.
          if (Math.abs(cantidadNum) > 1e-9) {
            item.almacenes.push({
              almacen_id: Number(r.almacen_id),
              cantidad: cantidadNum,
            });
          }

          item.total = Number((item.total + cantidadNum).toFixed(4));
        }
      }

      return {
        data: Array.from(map.values()),
      };
    } finally {
      await qr.release();
    }
  }
}

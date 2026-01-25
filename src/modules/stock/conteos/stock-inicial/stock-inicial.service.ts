import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryStockInicialDto } from './dto/query-stock-inicial.dto';

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
   * Devuelve el stock inicial del día:
   * - Si existe snapshot exacto del día: devuelve ese.
   * - Si no existe: devuelve el último snapshot anterior por producto+almacén.
   */
  async obtenerStockInicial(q: QueryStockInicialDto) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();

    try {
      const dia = q.dia?.slice(0, 10) ?? (await this.hoyAR(qr)); // 'YYYY-MM-DD'

      // Último snapshot disponible <= dia por producto+almacén
      const rows = await qr.query(
        `
        SELECT DISTINCT ON (producto_id, almacen_id)
          producto_id,
          almacen_id,
          cantidad_inicial,
          dia
        FROM public.stk_stock_inicial_diario
        WHERE dia <= $1::date
        ORDER BY producto_id, almacen_id, dia DESC
        `,
        [dia],
      );

      return {
        dia_consulta: dia,
        data: rows.map((r: any) => ({
          producto_id: Number(r.producto_id),
          almacen_id: Number(r.almacen_id),
          cantidad_inicial: String(r.cantidad_inicial),
          dia_snapshot: String(r.dia),
        })),
      };
    } finally {
      await qr.release();
    }
  }
}

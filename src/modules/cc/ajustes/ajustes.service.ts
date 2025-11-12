import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateAjusteDto } from './dto/create-ajuste.dto';
import { QueryAjustesDto } from './dto/query-ajustes.dto';

function toDec4(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(4);
}

@Injectable()
export class AjustesService {
  constructor(private readonly ds: DataSource) {}

  // Crea NC/ND:
  // - NC: aplica FIFO a cargos con saldo > 0 (como un pago, pero registrado como ajuste)
  // - ND: genera cargo nuevo (incrementa deuda)
  async crearAjuste(dto: CreateAjusteDto) {
    if (dto.monto_total <= 0)
      throw new BadRequestException('monto_total debe ser > 0');

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Cliente existe?
      const cli = await qr.query(
        `SELECT id FROM public.cc_clientes WHERE id = $1`,
        [dto.cliente_id],
      );
      if (!cli?.length) throw new BadRequestException('Cliente inexistente');

      // Idempotencia por (cliente_id, tipo, referencia_externa) si vino referencia_externa
      if (dto.referencia_externa) {
        const ya = await qr.query(
          `SELECT id FROM public.cc_ajustes
           WHERE cliente_id = $1 AND tipo = $2 AND referencia_externa = $3
           LIMIT 1`,
          [dto.cliente_id, dto.tipo, dto.referencia_externa],
        );
        if (ya?.length) {
          const id = ya[0].id;
          const out = await this._detalleAjusteTx(qr, id);
          (out as any).idempotente = true;
          await qr.rollbackTransaction();
          return out;
        }
      }

      // Crear ajuste
      const [aj] = await qr.query(
        `INSERT INTO public.cc_ajustes
           (fecha, cliente_id, tipo, monto_total, referencia_externa, observacion)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, fecha, cliente_id, tipo, monto_total, referencia_externa, observacion, created_at, updated_at`,
        [
          new Date(dto.fecha),
          dto.cliente_id,
          dto.tipo,
          toDec4(dto.monto_total),
          dto.referencia_externa ?? null,
          dto.observacion ?? null,
        ],
      );

      let aplicado = 0;

      if (dto.tipo === 'NC') {
        // Aplica FIFO a cargos abiertos
        let restante = Number(dto.monto_total);

        const cargos = await qr.query(
          `
          SELECT c.id,
                 c.fecha,
                 c.importe::numeric AS importe,
                 (c.importe
                  - COALESCE((SELECT SUM(pd.importe)::numeric FROM public.cc_pagos_det pd WHERE pd.cargo_id = c.id),0)
                  - COALESCE((SELECT SUM(ad.importe)::numeric FROM public.cc_ajustes_det ad WHERE ad.cargo_id = c.id),0)
                 )::numeric AS saldo
          FROM public.cc_cargos c
          WHERE c.cliente_id = $1
            AND (c.importe
                 - COALESCE((SELECT SUM(pd.importe)::numeric FROM public.cc_pagos_det pd WHERE pd.cargo_id = c.id),0)
                 - COALESCE((SELECT SUM(ad.importe)::numeric FROM public.cc_ajustes_det ad WHERE ad.cargo_id = c.id),0)
                ) > 0
          ORDER BY c.fecha ASC, c.id ASC
          FOR UPDATE OF c SKIP LOCKED
          `,
          [dto.cliente_id],
        );

        for (const c of cargos) {
          if (restante <= 1e-9) break;
          const saldo = Number(c.saldo);
          if (saldo <= 0) continue;
          const toma = Math.min(restante, saldo);

          await qr.query(
            `INSERT INTO public.cc_ajustes_det (ajuste_id, cargo_id, importe)
             VALUES ($1,$2,$3)`,
            [aj.id, c.id, toDec4(toma)],
          );

          aplicado += toma;
          restante = Number((restante - toma).toFixed(4));
        }

        // si sobra, queda "crédito" como NC no aplicada (se refleja en estado global por monto_total vs aplicado)
      } else {
        // ND: crear un CARGO que incrementa la deuda
        const [cargo] = await qr.query(
          `INSERT INTO public.cc_cargos
             (fecha, cliente_id, importe, venta_ref_tipo, venta_ref_id, observacion)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id, fecha, importe`,
          [
            new Date(dto.fecha),
            dto.cliente_id,
            toDec4(dto.monto_total),
            'AJUSTE_ND',
            aj.id,
            dto.observacion ?? null,
          ],
        );

        // Guardamos un detalle que vincula el ND con su cargo
        await qr.query(
          `INSERT INTO public.cc_ajustes_det (ajuste_id, cargo_id, importe)
           VALUES ($1,$2,$3)`,
          [aj.id, cargo.id, toDec4(dto.monto_total)],
        );
        aplicado = Number(dto.monto_total); // para ND, todo el monto queda "aplicado" a su cargo generado
      }

      await qr.commitTransaction();

      return {
        ok: true,
        ajuste: {
          id: aj.id,
          fecha: aj.fecha,
          cliente_id: aj.cliente_id,
          tipo: aj.tipo,
          monto_total: aj.monto_total,
          referencia_externa: aj.referencia_externa,
          observacion: aj.observacion,
        },
        aplicado: toDec4(aplicado),
        sin_aplicar:
          dto.tipo === 'NC'
            ? toDec4(Number(dto.monto_total) - aplicado)
            : toDec4(0),
      };
    } catch (e: any) {
      await qr.rollbackTransaction();
      throw new BadRequestException(
        e?.detail || e?.message || 'Error creando ajuste',
      );
    } finally {
      await qr.release();
    }
  }

  // Listado de ajustes (con aplicado / sin_aplicar)
  async listarAjustes(q: QueryAjustesDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conds: string[] = ['1=1'];
    const params: any[] = [];
    let p = 1;

    if (q.cliente_id) {
      conds.push(`a.cliente_id = $${p++}`);
      params.push(q.cliente_id);
    }
    if (q.tipo) {
      conds.push(`a.tipo = $${p++}`);
      params.push(q.tipo);
    }
    if (q.desde) {
      conds.push(`a.fecha >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      conds.push(`a.fecha < $${p++}`);
      params.push(new Date(q.hasta));
    }
    if (q.referencia_externa?.trim()) {
      conds.push(`a.referencia_externa ILIKE $${p++}`);
      params.push(`%${q.referencia_externa.trim()}%`);
    }

    const where = conds.join(' AND ');
    const idxLimit = p++;
    const idxOffset = p++;

    const baseSql = `
      WITH aplicado AS (
        SELECT ajuste_id, COALESCE(SUM(importe),0)::numeric(18,4) AS aplicado
        FROM public.cc_ajustes_det
        GROUP BY ajuste_id
      )
      SELECT
        a.id, a.fecha, a.cliente_id, a.tipo,
        a.monto_total::numeric(18,4) AS monto_total,
        COALESCE(ap.aplicado,0)::numeric(18,4) AS aplicado,
        CASE WHEN a.tipo = 'NC'
             THEN (a.monto_total - COALESCE(ap.aplicado,0))::numeric(18,4)
             ELSE 0::numeric(18,4)
        END AS sin_aplicar,
        a.referencia_externa, a.observacion, a.created_at, a.updated_at
      FROM public.cc_ajustes a
      LEFT JOIN aplicado ap ON ap.ajuste_id = a.id
      WHERE ${where}
      ORDER BY a.fecha ${order}, a.id ${order}
      LIMIT $${idxLimit} OFFSET $${idxOffset};
    `;

    const countSql = `SELECT COUNT(1)::int AS c FROM public.cc_ajustes a WHERE ${where}`;

    const [rows, total] = await Promise.all([
      this.ds.query(baseSql, [...params, limit, offset]),
      this.ds
        .query(countSql, params)
        .then((r) => (r?.[0]?.c ? Number(r[0].c) : 0)),
    ]);

    return { data: rows, total, page, limit };
  }

  // Detalle con aplicaciones
  async detalleAjuste(id: string) {
    const aj = await this.ds.query(
      `SELECT id, fecha, cliente_id, tipo, monto_total::numeric(18,4) AS monto_total,
              referencia_externa, observacion, created_at, updated_at
       FROM public.cc_ajustes WHERE id = $1`,
      [id],
    );
    if (!aj?.length) throw new NotFoundException('Ajuste no encontrado');

    const det = await this.ds.query(
      `SELECT d.id AS ajuste_det_id, d.cargo_id,
              d.importe::numeric(18,4) AS importe,
              c.fecha AS cargo_fecha,
              c.venta_ref_tipo, c.venta_ref_id
       FROM public.cc_ajustes_det d
       JOIN public.cc_cargos c ON c.id = d.cargo_id
       WHERE d.ajuste_id = $1
       ORDER BY d.id ASC`,
      [id],
    );

    const aplicado = det.reduce(
      (acc: number, x: any) => acc + Number(x.importe || 0),
      0,
    );
    const sin_aplicar =
      aj[0].tipo === 'NC'
        ? Math.max(0, Number(aj[0].monto_total) - aplicado).toFixed(4)
        : '0.0000';

    return {
      ajuste: { ...aj[0], aplicado: aplicado.toFixed(4), sin_aplicar },
      aplicaciones: det,
    };
  }

  // helper para idempotencia dentro de TX
  private async _detalleAjusteTx(
    qr: ReturnType<DataSource['createQueryRunner']>,
    id: string,
  ) {
    const aj = await qr.query(
      `SELECT id, fecha, cliente_id, tipo, monto_total::numeric(18,4) AS monto_total,
              referencia_externa, observacion, created_at, updated_at
       FROM public.cc_ajustes WHERE id = $1`,
      [id],
    );
    const det = await qr.query(
      `SELECT id AS ajuste_det_id, cargo_id, importe::numeric(18,4) AS importe
       FROM public.cc_ajustes_det
       WHERE ajuste_id = $1
       ORDER BY id ASC`,
      [id],
    );
    const aplicado = det.reduce(
      (acc: number, x: any) => acc + Number(x.importe || 0),
      0,
    );
    const sin_aplicar =
      aj[0].tipo === 'NC'
        ? Math.max(0, Number(aj[0].monto_total) - aplicado).toFixed(4)
        : '0.0000';

    return {
      ok: true,
      ajuste: aj[0],
      aplicado: aplicado.toFixed(4),
      sin_aplicar,
      aplicaciones: det,
    };
  }
}

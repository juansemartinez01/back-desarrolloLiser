import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreatePagoDto } from './dto/create-pago.dto';
import { QueryPagosDto } from './dto/query-pagos.dto';

function toDec4(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(4);
}

@Injectable()
export class PagosService {
  constructor(private readonly ds: DataSource) {}

  // Crea el pago y aplica FIFO a los cargos abiertos del cliente
  async crearPagoYAplicar(dto: CreatePagoDto) {
    if (dto.importe_total <= 0) {
      throw new BadRequestException('importe_total debe ser > 0');
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // 0) Validaciones base
      const cli = await qr.query(
        `SELECT id FROM public.cc_clientes WHERE id = $1`,
        [dto.cliente_id],
      );
      if (!cli?.length) throw new BadRequestException('Cliente inexistente');

      // 1) Idempotencia si hay referencia_externa
      if (dto.referencia_externa) {
        const ya = await qr.query(
          `
          SELECT p.id
          FROM public.cc_pagos p
          WHERE p.cliente_id = $1 AND p.cuenta = $2 AND p.referencia_externa = $3
          LIMIT 1
          `,
          [dto.cliente_id, dto.cuenta, dto.referencia_externa],
        );
        if (ya?.length) {
          const pagoId = ya[0].id;
          // devolver detalle existente
          const out = await this._detallePagoTx(qr, pagoId);
          out.idempotente = true;
          await qr.rollbackTransaction(); // no hicimos cambios
          return out;
        }
      }

      // 2) Crear pago
      const pagoRows = await qr.query(
        `
        INSERT INTO public.cc_pagos
          (fecha, cliente_id, cuenta, importe_total, referencia_externa, observacion)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, fecha, cliente_id, cuenta, importe_total, referencia_externa, observacion, created_at, updated_at
        `,
        [
          new Date(dto.fecha),
          dto.cliente_id,
          dto.cuenta,
          toDec4(dto.importe_total),
          dto.referencia_externa ?? null,
          dto.observacion ?? null,
        ],
      );
      const pago = pagoRows[0];
      let restante = Number(pago.importe_total);

      // 3) Traer cargos abiertos (saldo > 0) orden FIFO y lockearlos
      //    (saldo = importe - aplicado_actual)
      const cargos = await qr.query(
        `
        SELECT c.id,
               c.fecha,
               c.importe::numeric AS importe,
               (c.importe - COALESCE((
                  SELECT SUM(d.importe)::numeric FROM public.cc_pagos_det d WHERE d.cargo_id = c.id
               ),0))::numeric AS saldo
        FROM public.cc_cargos c
        WHERE c.cliente_id = $1
          AND (c.importe - COALESCE((
                SELECT SUM(d.importe)::numeric FROM public.cc_pagos_det d WHERE d.cargo_id = c.id
              ),0)) > 0
        ORDER BY c.fecha ASC, c.id ASC
        FOR UPDATE OF c SKIP LOCKED
        `,
        [dto.cliente_id],
      );

      const aplicaciones: Array<{ cargo_id: string; importe: string }> = [];

      for (const c of cargos) {
        if (restante <= 1e-9) break;
        const saldo = Number(c.saldo);
        if (saldo <= 0) continue;

        const aplica = Math.min(restante, saldo);
        await qr.query(
          `
          INSERT INTO public.cc_pagos_det (pago_id, cargo_id, importe)
          VALUES ($1,$2,$3)
          `,
          [pago.id, c.id, toDec4(aplica)],
        );
        aplicaciones.push({ cargo_id: c.id, importe: toDec4(aplica) });
        restante = Number((restante - aplica).toFixed(4));
      }

      await qr.commitTransaction();

      return {
        ok: true,
        pago: {
          id: pago.id,
          fecha: pago.fecha,
          cliente_id: pago.cliente_id,
          cuenta: pago.cuenta,
          importe_total: pago.importe_total,
          referencia_externa: pago.referencia_externa,
          observacion: pago.observacion,
        },
        aplicado: toDec4(
          Number(pago.importe_total) - Math.max(0, Number(restante)),
        ),
        sin_aplicar: toDec4(Math.max(0, Number(restante))),
        aplicaciones,
      };
    } catch (e: any) {
      await qr.rollbackTransaction();
      throw new BadRequestException(
        e?.detail || e?.message || 'Error creando/aplicando pago',
      );
    } finally {
      await qr.release();
    }
  }

  // Listado de pagos con aplicado/sin_aplicar
  async listarPagos(q: QueryPagosDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conds: string[] = ['1=1'];
    const params: any[] = [];
    let p = 1;

    if (q.cliente_id) {
      conds.push(`p.cliente_id = $${p++}`);
      params.push(q.cliente_id);
    }
    if (q.cuenta) {
      conds.push(`p.cuenta = $${p++}`);
      params.push(q.cuenta);
    }
    if (q.desde) {
      conds.push(`p.fecha >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      conds.push(`p.fecha < $${p++}`);
      params.push(new Date(q.hasta));
    }
    if (q.referencia_externa?.trim()) {
      conds.push(`p.referencia_externa ILIKE $${p++}`);
      params.push(`%${q.referencia_externa.trim()}%`);
    }

    const where = conds.join(' AND ');
    const idxLimit = p++;
    const idxOffset = p++;

    const baseSql = `
      WITH aplicado AS (
        SELECT pago_id, COALESCE(SUM(importe),0)::numeric(18,4) AS aplicado
        FROM public.cc_pagos_det
        GROUP BY pago_id
      )
      SELECT
        p.id, p.fecha, p.cliente_id, p.cuenta, p.importe_total::numeric(18,4) AS importe_total,
        COALESCE(a.aplicado,0)::numeric(18,4) AS aplicado,
        (p.importe_total - COALESCE(a.aplicado,0))::numeric(18,4) AS sin_aplicar,
        p.referencia_externa, p.observacion, p.created_at, p.updated_at
      FROM public.cc_pagos p
      LEFT JOIN aplicado a ON a.pago_id = p.id
      WHERE ${where}
      ORDER BY p.fecha ${order}, p.id ${order}
      LIMIT $${idxLimit} OFFSET $${idxOffset};
    `;

    const countSql = `
      SELECT COUNT(1)::int AS c
      FROM public.cc_pagos p
      WHERE ${where};
    `;

    const [rows, count] = await Promise.all([
      this.ds.query(baseSql, [...params, limit, offset]),
      this.ds
        .query(countSql, params)
        .then((r) => (r?.[0]?.c ? Number(r[0].c) : 0)),
    ]);

    return { data: rows, total: count, page, limit };
  }

  // Detalle: pago + aplicaciones (y sin_aplicar)
  async detallePago(id: string) {
    const pago = await this.ds.query(
      `
      SELECT id, fecha, cliente_id, cuenta, importe_total::numeric(18,4) AS importe_total,
             referencia_externa, observacion, created_at, updated_at
      FROM public.cc_pagos
      WHERE id = $1
      `,
      [id],
    );
    if (!pago?.length) throw new NotFoundException('Pago no encontrado');

    const apps = await this.ds.query(
      `
      SELECT
        d.id        AS pago_det_id,
        d.cargo_id  AS cargo_id,
        d.importe::numeric(18,4) AS importe,
        c.fecha     AS cargo_fecha,
        c.venta_ref_tipo,
        c.venta_ref_id
      FROM public.cc_pagos_det d
      JOIN public.cc_cargos c ON c.id = d.cargo_id
      WHERE d.pago_id = $1
      ORDER BY d.id ASC
      `,
      [id],
    );

    const aplicado = apps.reduce((acc, x) => acc + Number(x.importe || 0), 0);
    const sin_aplicar = Math.max(
      0,
      Number(pago[0].importe_total) - aplicado,
    ).toFixed(4);

    return {
      pago: { ...pago[0], aplicado: aplicado.toFixed(4), sin_aplicar },
      aplicaciones: apps,
    };
  }

  // Helper para detalle dentro de una transacción (idempotencia)
  private async _detallePagoTx(
    qr: ReturnType<DataSource['createQueryRunner']>,
    pagoId: string,
  ) {
    const pago = await qr.query(
      `
      SELECT id, fecha, cliente_id, cuenta, importe_total::numeric(18,4) AS importe_total,
             referencia_externa, observacion, created_at, updated_at
      FROM public.cc_pagos
      WHERE id = $1
      `,
      [pagoId],
    );
    const apps = await qr.query(
      `
      SELECT
        d.id AS pago_det_id, d.cargo_id, d.importe::numeric(18,4) AS importe
      FROM public.cc_pagos_det d
      WHERE d.pago_id = $1
      ORDER BY d.id ASC
      `,
      [pagoId],
    );
    const aplicado = apps.reduce(
      (acc: number, x: any) => acc + Number(x.importe || 0),
      0,
    );
    const sin_aplicar = Math.max(
      0,
      Number(pago[0].importe_total) - aplicado,
    ).toFixed(4);
    return {
      ok: true,
      pago: pago[0],
      aplicado: aplicado.toFixed(4),
      sin_aplicar,
      aplicaciones: apps,
      idempotente: false, // default value, can be overwritten by caller
    };
  }
}

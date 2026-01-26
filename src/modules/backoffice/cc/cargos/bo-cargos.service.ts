// src/modules/backoffice/cc/cargos/bo-cargos.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BoCreateCargoDto } from './dto/bo-create-cargo.dto';
import { BoQueryCargosDto } from './dto/bo-query-cargos.dto';

const BO_CUENTA = 'CUENTA1';

function toDec4(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(4);
}

@Injectable()
export class BoCargosService {
  constructor(private readonly ds: DataSource) {}

  // Idempotente por (cliente_id, CUENTA1, venta_ref_tipo, venta_ref_id)
  async crearCargo(dto: BoCreateCargoDto) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const cli = await qr.query(
        `SELECT id FROM public.cc_clientes WHERE id = $1`,
        [dto.cliente_id],
      );
      if (!cli?.length) throw new BadRequestException('Cliente inexistente');

      const fecha = new Date(dto.fecha);
      const fv = dto.fecha_vencimiento ? new Date(dto.fecha_vencimiento) : null;

      const row = await qr.query(
        `
        INSERT INTO public.cc_cargos
          (fecha, fecha_vencimiento, cliente_id, cuenta, venta_ref_tipo, venta_ref_id, importe, observacion)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (cliente_id, cuenta, venta_ref_tipo, venta_ref_id)
        DO UPDATE SET
          fecha = EXCLUDED.fecha,
          fecha_vencimiento = EXCLUDED.fecha_vencimiento,
          importe = EXCLUDED.importe,
          observacion = EXCLUDED.observacion,
          updated_at = now()
        RETURNING id, fecha, fecha_vencimiento, cliente_id, venta_ref_tipo, venta_ref_id,
                  importe, observacion, created_at, updated_at;
        `,
        [
          fecha,
          fv,
          dto.cliente_id,
          BO_CUENTA,
          dto.venta_ref_tipo || 'VENTA',
          dto.venta_ref_id,
          toDec4(dto.importe),
          dto.observacion ?? null,
        ],
      );

      await qr.commitTransaction();

      const created =
        Math.abs(
          new Date(row[0].created_at).getTime() -
            new Date(row[0].updated_at).getTime(),
        ) < 1500;

      return { ok: true, idempotente: !created, cargo: row[0] };
    } catch (e: any) {
      await qr.rollbackTransaction();
      throw new BadRequestException(
        e?.detail || e?.message || 'Error creando cargo',
      );
    } finally {
      await qr.release();
    }
  }

  async crearCargosBulk(items: BoCreateCargoDto[]) {
    if (!items?.length)
      throw new BadRequestException('Debe enviar al menos un cargo');
    const results: any[] = [];
    for (const it of items) results.push(await this.crearCargo(it));
    return { ok: true, results };
  }

  async listarCargos(q: BoQueryCargosDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conds: string[] = ['c.cuenta = $1'];
    const params: any[] = [BO_CUENTA];
    let p = 2;

    if (q.cliente_id) {
      conds.push(`c.cliente_id = $${p++}`);
      params.push(q.cliente_id);
    }
    if (q.desde) {
      conds.push(`c.fecha >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      conds.push(`c.fecha < $${p++}`);
      params.push(new Date(q.hasta));
    }
    if (q.venta_ref_id?.trim()) {
      conds.push(`c.venta_ref_id ILIKE $${p++}`);
      params.push(`%${q.venta_ref_id.trim()}%`);
    }
    if (q.venta_ref_tipo?.trim()) {
      conds.push(`c.venta_ref_tipo = $${p++}`);
      params.push(q.venta_ref_tipo.trim());
    }

    const where = conds.join(' AND ');
    const idxLimit = p++;
    const idxOffset = p++;

    const baseSql = `
      WITH aplicado AS (
        SELECT cargo_id, COALESCE(SUM(importe),0)::numeric(18,4) AS aplicado
        FROM public.cc_pagos_det
        GROUP BY cargo_id
      )
      SELECT
        c.id, c.fecha, c.fecha_vencimiento, c.cliente_id,
        c.venta_ref_tipo, c.venta_ref_id,
        c.importe::numeric(18,4) AS importe,
        COALESCE(a.aplicado, 0)::numeric(18,4) AS aplicado,
        (c.importe - COALESCE(a.aplicado,0))::numeric(18,4) AS saldo,
        c.observacion, c.created_at, c.updated_at
      FROM public.cc_cargos c
      LEFT JOIN aplicado a ON a.cargo_id = c.id
      WHERE ${where}
      ORDER BY c.fecha ${order}, c.id ${order}
      LIMIT $${idxLimit} OFFSET $${idxOffset};
    `;

    const countSql = `SELECT COUNT(1)::int AS c FROM public.cc_cargos c WHERE ${where};`;

    const [rows, total] = await Promise.all([
      this.ds.query(baseSql, [...params, limit, offset]),
      this.ds
        .query(countSql, params)
        .then((r) => (r?.[0]?.c ? Number(r[0].c) : 0)),
    ]);

    return { data: rows, total, page, limit };
  }

  async obtenerCargo(id: string) {
    const cargo = await this.ds.query(
      `
      WITH aplicado AS (
        SELECT cargo_id, COALESCE(SUM(importe),0)::numeric(18,4) AS aplicado
        FROM public.cc_pagos_det
        WHERE cargo_id = $1
        GROUP BY cargo_id
      )
      SELECT
        c.id, c.fecha, c.fecha_vencimiento, c.cliente_id,
        c.venta_ref_tipo, c.venta_ref_id,
        c.importe::numeric(18,4) AS importe,
        COALESCE(a.aplicado, 0)::numeric(18,4) AS aplicado,
        (c.importe - COALESCE(a.aplicado,0))::numeric(18,4) AS saldo,
        c.observacion, c.created_at, c.updated_at
      FROM public.cc_cargos c
      LEFT JOIN aplicado a ON a.cargo_id = c.id
      WHERE c.id = $1 AND c.cuenta = $2
      `,
      [id, BO_CUENTA],
    );
    if (!cargo?.length) throw new NotFoundException('Cargo no encontrado');

    const apps = await this.ds.query(
      `
      SELECT
        d.id AS pago_det_id,
        d.importe::numeric(18,4) AS importe,
        p.id   AS pago_id,
        p.fecha,
        p.referencia_externa,
        p.observacion
      FROM public.cc_pagos_det d
      JOIN public.cc_pagos p ON p.id = d.pago_id
      WHERE d.cargo_id = $1 AND p.cuenta = $2
      ORDER BY p.fecha ASC, d.id ASC
      `,
      [id, BO_CUENTA],
    );

    return { cargo: cargo[0], aplicaciones: apps };
  }
}

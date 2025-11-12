import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { QueryCargosDto } from './dto/query-cargos.dto';

function toDec4(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(4);
}

@Injectable()
export class CargosService {
  constructor(private readonly ds: DataSource) {}

  // Crea cargo idempotente por (cliente_id, venta_ref_tipo, venta_ref_id)
  async crearCargo(dto: CreateCargoDto) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // validar cliente existe
      const cli = await qr.query(
        `SELECT id FROM public.cc_clientes WHERE id = $1`,
        [dto.cliente_id],
      );
      if (!cli?.length) throw new BadRequestException('Cliente inexistente');

      const fecha = new Date(dto.fecha);
      const fv = dto.fecha_vencimiento ? new Date(dto.fecha_vencimiento) : null;

      // ON CONFLICT para idempotencia devolviendo la fila (creada o existente)
      const row = await qr.query(
        `
        INSERT INTO public.cc_cargos
          (fecha, fecha_vencimiento, cliente_id, venta_ref_tipo, venta_ref_id, importe, observacion)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (cliente_id, venta_ref_tipo, venta_ref_id)
        DO UPDATE SET updated_at = now()
        RETURNING id, fecha, fecha_vencimiento, cliente_id, venta_ref_tipo, venta_ref_id, importe, observacion, created_at, updated_at;
        `,
        [
          fecha,
          fv,
          dto.cliente_id,
          dto.venta_ref_tipo || 'VENTA',
          dto.venta_ref_id,
          toDec4(dto.importe),
          dto.observacion ?? null,
        ],
      );

      await qr.commitTransaction();

      // identificar si fue recién creado (aprox: created_at ~ updated_at ± 1s)
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

  async crearCargosBulk(items: CreateCargoDto[]) {
    if (!items?.length)
      throw new BadRequestException('Debe enviar al menos un cargo');

    const results: any[] = [];
    for (const it of items) {
      // Ejecutamos de a uno para reportar bien cada resultado (también se podría hacer en lote)
      const r = await this.crearCargo(it);
      results.push(r);
    }
    return { ok: true, results };
  }

  // Listado con filtros + aplicado y saldo (LEFT JOIN a cc_pagos_det)
  async listarCargos(q: QueryCargosDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conds: string[] = ['1=1'];
    const params: any[] = [];
    let p = 1;

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

    const countSql = `
      SELECT COUNT(1)::int AS c
      FROM public.cc_cargos c
      WHERE ${where};
    `;

    const dataParams = [...params, limit, offset];
    const [rows, countRes] = await Promise.all([
      this.ds.query(baseSql, dataParams),
      this.ds
        .query(countSql, params)
        .then((r) => (r?.[0]?.c ? Number(r[0].c) : 0)),
    ]);

    return { data: rows, total: countRes, page, limit };
  }

  // Detalle: cargo + aplicaciones
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
      WHERE c.id = $1
      `,
      [id],
    );
    if (!cargo?.length) throw new NotFoundException('Cargo no encontrado');

    const apps = await this.ds.query(
      `
      SELECT
        d.id AS pago_det_id,
        d.importe::numeric(18,4) AS importe,
        p.id   AS pago_id,
        p.fecha,
        p.cuenta,
        p.referencia_externa,
        p.observacion
      FROM public.cc_pagos_det d
      JOIN public.cc_pagos p ON p.id = d.pago_id
      WHERE d.cargo_id = $1
      ORDER BY p.fecha ASC, d.id ASC
      `,
      [id],
    );

    return { cargo: cargo[0], aplicaciones: apps };
  }
}

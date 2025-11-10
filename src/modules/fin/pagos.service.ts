import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Pago, PagoEstado } from './entities/pago.entity';
import { PagoAplic } from './entities/pago-aplic.entity';
import { AplicarPagoDto, CrearPagoDto, QueryPagosDto } from './dto/pagos.dto';

const to4 = (n: number | string) => Number(n).toFixed(4);

@Injectable()
export class PagosService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Pago) private pagos: Repository<Pago>,
    @InjectRepository(PagoAplic) private aplics: Repository<PagoAplic>,
  ) {}

  // saldo pendiente de una liquidación (CONFIRMADAS)
  private async saldoLiquidacion(liqId: string): Promise<number> {
    const row = await this.ds.query(
      `
      SELECT
        l.total_monto
        - COALESCE((
            SELECT SUM(a.monto_aplicado)
            FROM fin_pago_aplic a
            JOIN fin_pagos p ON p.id = a.pago_id
            WHERE a.liquidacion_id = l.id AND p.estado = 'REGISTRADO'
          ),0) AS saldo
      FROM fin_liquidaciones l
      WHERE l.id = $1 AND l.estado = 'CONFIRMADA'
      `,
      [liqId],
    );
    if (!row.length)
      throw new NotFoundException('Liquidación no encontrada o no confirmada');
    return Number(row[0].saldo || 0);
  }

  private async saldoPago(pagoId: string): Promise<number> {
    const row = await this.ds.query(
      `
      SELECT
        p.monto_total
        - COALESCE((
            SELECT SUM(a.monto_aplicado) FROM fin_pago_aplic a WHERE a.pago_id = p.id
          ),0) AS saldo
      FROM fin_pagos p
      WHERE p.id = $1 AND p.estado = 'REGISTRADO'
      `,
      [pagoId],
    );
    if (!row.length)
      throw new NotFoundException('Pago no encontrado o no registrado');
    return Number(row[0].saldo || 0);
  }

  async crear(dto: CrearPagoDto) {
    const montoApps = Number(
      (dto.aplicaciones ?? [])
        .reduce((s, a) => s + Number(a.monto), 0)
        .toFixed(4),
    );
    const montoTotal = Number((dto.monto_total ?? montoApps).toFixed(4));
    if (!(montoTotal > 0))
      throw new BadRequestException('monto_total debe ser > 0');

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const pago = qr.manager.create(Pago, {
        proveedor_id: dto.proveedor_id,
        fecha: new Date(dto.fecha),
        estado: PagoEstado.REGISTRADO,
        monto_total: to4(montoTotal),
        referencia_externa: dto.referencia_externa ?? null,
        observacion: dto.observacion ?? null,
      });
      await qr.manager.save(pago);

      let aplicado = 0;
      for (const a of dto.aplicaciones ?? []) {
        const saldo = await this.saldoLiquidacion(a.liquidacion_id);
        if (a.monto > saldo + 1e-9) {
          throw new BadRequestException(
            `La liquidación ${a.liquidacion_id} no tiene saldo suficiente (saldo=${to4(saldo)}, pedido=${to4(a.monto)})`,
          );
        }
        aplicado += a.monto;
        if (aplicado > montoTotal + 1e-9) {
          throw new BadRequestException(
            'La suma de aplicaciones excede monto_total del pago',
          );
        }
        const ap = qr.manager.create(PagoAplic, {
          pago,
          liquidacion_id: a.liquidacion_id,
          monto_aplicado: to4(a.monto),
        });
        await qr.manager.save(ap);
      }

      await qr.commitTransaction();
      return {
        ok: true,
        id: pago.id,
        proveedor_id: pago.proveedor_id,
        fecha: pago.fecha,
        estado: pago.estado,
        monto_total: pago.monto_total,
        aplicado: to4(aplicado),
        saldo: to4(montoTotal - aplicado),
      };
    } catch (e: any) {
      await qr.rollbackTransaction();
      throw new BadRequestException(
        e?.detail || e?.message || 'Error creando pago',
      );
    } finally {
      await qr.release();
    }
  }

  async aplicar(pagoId: string, dto: AplicarPagoDto) {
    const pago = await this.pagos.findOne({ where: { id: pagoId } });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    if (pago.estado !== PagoEstado.REGISTRADO)
      throw new BadRequestException('Solo pagos REGISTRADO permiten aplicar');

    const saldo = await this.saldoPago(pagoId);
    const aplicaTotal = Number(
      dto.aplicaciones.reduce((s, a) => s + Number(a.monto), 0).toFixed(4),
    );
    if (aplicaTotal > saldo + 1e-9)
      throw new BadRequestException(
        `Saldo del pago insuficiente (saldo=${to4(saldo)}, pedido=${to4(aplicaTotal)})`,
      );

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const a of dto.aplicaciones) {
        const sl = await this.saldoLiquidacion(a.liquidacion_id);
        if (a.monto > sl + 1e-9)
          throw new BadRequestException(
            `La liquidación ${a.liquidacion_id} no tiene saldo suficiente (saldo=${to4(sl)}, pedido=${to4(a.monto)})`,
          );
        const ap = qr.manager.create(PagoAplic, {
          pago: { id: pagoId } as any,
          liquidacion_id: a.liquidacion_id,
          monto_aplicado: to4(a.monto),
        });
        await qr.manager.save(ap);
      }
      await qr.commitTransaction();
      const nuevoSaldo = await this.saldoPago(pagoId);
      return { ok: true, pago_id: pagoId, saldo: to4(nuevoSaldo) };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async anular(pagoId: string) {
    const pago = await this.pagos.findOne({ where: { id: pagoId } });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    if (pago.estado === PagoEstado.ANULADO)
      return { ok: true, estado: pago.estado };

    pago.estado = PagoEstado.ANULADO;
    await this.pagos.save(pago);
    // Nota: no borramos aplicaciones; los reportes ignoran pagos ANULADO.
    return { ok: true, estado: pago.estado };
  }

  async listar(q: QueryPagosDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const where: string[] = ['1=1'];
    const params: any[] = [];
    let p = 1;

    if (q.proveedor_id) {
      where.push(`p.proveedor_id = $${p++}`);
      params.push(q.proveedor_id);
    }
    if (q.estado) {
      where.push(`p.estado = $${p++}`);
      params.push(q.estado);
    }
    if (q.desde) {
      where.push(`p.fecha >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      where.push(`p.fecha <  $${p++}`);
      params.push(new Date(q.hasta));
    }

    const data = await this.ds.query(
      `
      SELECT p.id, p.proveedor_id, p.fecha, p.estado, p.monto_total, p.referencia_externa, p.observacion,
             COALESCE( (SELECT SUM(a.monto_aplicado) FROM fin_pago_aplic a WHERE a.pago_id = p.id), 0 ) AS aplicado,
             (p.monto_total - COALESCE( (SELECT SUM(a.monto_aplicado) FROM fin_pago_aplic a WHERE a.pago_id = p.id), 0 ))::numeric(18,4) AS saldo
      FROM fin_pagos p
      WHERE ${where.join(' AND ')}
      ORDER BY p.fecha ${order}, p.created_at ${order}
      LIMIT ${limit} OFFSET ${offset}
      `,
      params,
    );

    const total = await this.ds
      .query(
        `SELECT COUNT(1)::int AS c FROM fin_pagos p WHERE ${where.join(' AND ')}`,
        params,
      )
      .then((r: any[]) => r?.[0]?.c ?? 0);

    return { data, total, page, limit };
  }

  async detalle(id: string) {
    const pago = await this.pagos.findOne({
      where: { id },
      relations: { aplicaciones: true },
    });
    if (!pago) throw new NotFoundException('Pago no encontrado');

    const aplicado = await this.ds
      .query(
        `SELECT COALESCE(SUM(monto_aplicado),0)::numeric AS a FROM fin_pago_aplic WHERE pago_id = $1`,
        [id],
      )
      .then((r: any[]) => Number(r?.[0]?.a || 0));

    return {
      id: pago.id,
      proveedor_id: pago.proveedor_id,
      fecha: pago.fecha,
      estado: pago.estado,
      monto_total: pago.monto_total,
      referencia_externa: pago.referencia_externa,
      observacion: pago.observacion,
      aplicado: to4(aplicado),
      saldo: to4(Number(pago.monto_total) - aplicado),
      aplicaciones:
        pago.aplicaciones?.map((a) => ({
          id: a.id,
          liquidacion_id: a.liquidacion_id,
          monto_aplicado: a.monto_aplicado,
        })) ?? [],
    };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Liquidacion } from './entities/liquidacion.entity';
import { LiquidacionDetalle } from './entities/liquidacion-detalle.entity';
import { CrearLiquidacionDto } from './dto/create-liquidacion.dto';
import { LiquidacionEstado } from './enums/liquidacion-estado.enum';
import { QueryLiquidacionesDto } from './dto/query-liquidaciones.dto';
import { ConfirmarLiquidacionDto } from './dto/confirmar-liquidacion.dto';

function to4(n: number | string) {
  return Number(n).toFixed(4);
}

@Injectable()
export class LiquidacionesService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Liquidacion) private liqRepo: Repository<Liquidacion>,
    @InjectRepository(LiquidacionDetalle)
    private detRepo: Repository<LiquidacionDetalle>,
  ) {}

  /**
   * Preview de remitos/ítems liquidables para un proveedor
   * Calcula: vendido por remito_item  -  ya_liquidado (solo CONFIRMADAS)
   */
  async previewLiquidables(proveedorId: number) {
    if (!proveedorId) throw new BadRequestException('proveedor_id requerido');

    // Vendido por remito_item
    const vendidos = await this.ds.query(
      `
      WITH ventas AS (
        SELECT l.remito_item_id,
               SUM(d.cantidad)::numeric(18,4) AS vendido
        FROM stk_lotes l
        JOIN stk_movimientos_det d ON d.lote_id = l.id AND d.efecto = -1
        JOIN stk_movimientos m ON m.id = d.movimiento_id AND m.tipo = 'VENTA'
        JOIN stk_remito_items ri ON ri.id = l.remito_item_id
        JOIN stk_remitos r ON r.id = ri.remito_id
        WHERE r.proveedor_id = $1
        GROUP BY l.remito_item_id
      ),
      liq AS (
        SELECT det.remito_item_id,
               COALESCE(SUM(det.cantidad_base),0)::numeric(18,4) AS ya_liquidado
        FROM fin_liquidacion_det det
        JOIN fin_liquidaciones liq ON liq.id = det.liquidacion_id
        WHERE liq.estado = 'CONFIRMADA'
        GROUP BY det.remito_item_id
      )
      SELECT
        r.id   AS remito_id,
        r.fecha_remito,
        r.numero_remito,
        ri.id  AS remito_item_id,
        ri.producto_id,
        ri.cantidad_total,
        COALESCE(v.vendido, 0)       AS vendido,
        COALESCE(l.ya_liquidado, 0)  AS ya_liquidado,
        GREATEST(COALESCE(v.vendido,0) - COALESCE(l.ya_liquidado,0), 0)::numeric(18,4) AS liquidable
      FROM stk_remito_items ri
      JOIN stk_remitos r ON r.id = ri.remito_id
      LEFT JOIN ventas v ON v.remito_item_id = ri.id
      LEFT JOIN liq l    ON l.remito_item_id = ri.id
      WHERE r.proveedor_id = $1
      ORDER BY r.fecha_remito ASC, ri.created_at ASC
      `,
      [proveedorId],
    );

    // Filtramos sólo los que tienen saldo liquidable > 0
    return vendidos.filter((x: any) => Number(x.liquidable) > 0);
  }

  async crear(dto: CrearLiquidacionDto) {
    if (!dto.detalles?.length) {
      throw new BadRequestException('Debe incluir detalles a liquidar');
    }
    // Validación rápida de proveedor-id homogéneo con remitos
    const remitoIds = Array.from(new Set(dto.detalles.map((d) => d.remito_id)));
    const provs = await this.ds.query(
      `SELECT DISTINCT proveedor_id FROM stk_remitos WHERE id = ANY($1::uuid[])`,
      [remitoIds],
    );
    if (
      provs.length !== 1 ||
      Number(provs[0].proveedor_id) !== dto.proveedor_id
    ) {
      throw new BadRequestException(
        'Todos los remitos deben pertenecer al proveedor indicado',
      );
    }

    // Validar cantidades base contra "liquidable"
    const liquidables = await this.previewLiquidables(dto.proveedor_id);
    const mapLiq = new Map<string, number>();
    for (const row of liquidables)
      mapLiq.set(row.remito_item_id, Number(row.liquidable));

    for (const det of dto.detalles) {
      if (det.remito_item_id) {
        const liq = mapLiq.get(det.remito_item_id) ?? 0;
        if (Number(det.cantidad_base) > liq + 1e-9) {
          throw new BadRequestException(
            `remito_item ${det.remito_item_id}: cantidad_base ${det.cantidad_base} excede liquidable ${to4(liq)}`,
          );
        }
      }
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const liq = qr.manager.create(Liquidacion, {
        proveedor_id: dto.proveedor_id,
        fecha: new Date(dto.fecha),
        estado: LiquidacionEstado.BORRADOR,
        referencia_externa: dto.referencia_externa ?? null,
        observacion: dto.observacion ?? null,
        total_monto: to4(
          dto.detalles.reduce((s, d) => s + Number(d.monto_pago), 0),
        ),
      });
      await qr.manager.save(liq);

      for (const d of dto.detalles) {
        const det = qr.manager.create(LiquidacionDetalle, {
          liquidacion: liq,
          remito_id: d.remito_id,
          remito_item_id: d.remito_item_id ?? null,
          producto_id: d.producto_id,
          cantidad_base: to4(d.cantidad_base ?? 0),
          monto_pago: to4(d.monto_pago),
          notas: d.notas ?? null,
        });
        await qr.manager.save(det);
      }

      await qr.commitTransaction();
      return {
        ok: true,
        id: liq.id,
        estado: liq.estado,
        total_monto: liq.total_monto,
      };
    } catch (e: any) {
      await qr.rollbackTransaction();
      // Posible violación de ux_fin_liq_prov_ref
      throw new BadRequestException(
        e?.detail || e?.message || 'Error creando liquidación',
      );
    } finally {
      await qr.release();
    }
  }

  async confirmar(id: string, dto: ConfirmarLiquidacionDto) {
    const liq = await this.liqRepo.findOne({
      where: { id },
      relations: { detalles: true },
    });
    if (!liq) throw new NotFoundException('Liquidación no encontrada');
    if (liq.estado !== LiquidacionEstado.BORRADOR) {
      throw new BadRequestException('Sólo BORRADOR puede confirmarse');
    }
    liq.estado = LiquidacionEstado.CONFIRMADA;
    if (dto?.observacion) liq.observacion = dto.observacion;
    await this.liqRepo.save(liq);
    return { ok: true, id: liq.id, estado: liq.estado };
    // Nota: no impactamos stock; sólo registramos el compromiso económico.
  }

  async listar(q: QueryLiquidacionesDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const params: any[] = [];
    let p = 1;
    const where: string[] = ['1=1'];

    if (q.proveedor_id) {
      where.push(`l.proveedor_id = $${p++}`);
      params.push(q.proveedor_id);
    }
    if (q.estado) {
      where.push(`l.estado = $${p++}`);
      params.push(q.estado);
    }
    if (q.desde) {
      where.push(`l.fecha >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      where.push(`l.fecha <  $${p++}`);
      params.push(new Date(q.hasta));
    }

    const data = await this.ds.query(
      `
        SELECT l.id, l.proveedor_id, l.fecha, l.estado, l.total_monto, l.referencia_externa, l.observacion
        FROM fin_liquidaciones l
        WHERE ${where.join(' AND ')}
        ORDER BY l.fecha ${order}, l.created_at ${order}
        LIMIT ${limit} OFFSET ${offset}
      `,
      params,
    );

    const total = await this.ds
      .query(
        `SELECT COUNT(1)::int AS c FROM fin_liquidaciones l WHERE ${where.join(' AND ')}`,
        params,
      )
      .then((r: any[]) => r?.[0]?.c ?? 0);

    return { data, total, page, limit };
  }

  async detalle(id: string) {
    const liq = await this.liqRepo.findOne({
      where: { id },
      relations: { detalles: true },
    });
    if (!liq) throw new NotFoundException('Liquidación no encontrada');

    // Traigo snapshot útil de remitos/ítems (opcional)
    const detRaw = await this.ds.query(
      `
      SELECT d.id, d.producto_id, d.cantidad_base, d.monto_pago, d.notas,
             r.numero_remito, r.fecha_remito,
             ri.unidad, ri.cantidad_total
      FROM fin_liquidacion_det d
      LEFT JOIN stk_remitos r       ON r.id  = d.remito_id
      LEFT JOIN stk_remito_items ri ON ri.id = d.remito_item_id
      WHERE d.liquidacion_id = $1
      ORDER BY r.fecha_remito ASC, d.created_at ASC
      `,
      [id],
    );

    return {
      id: liq.id,
      proveedor_id: liq.proveedor_id,
      fecha: liq.fecha,
      estado: liq.estado,
      total_monto: liq.total_monto,
      referencia_externa: liq.referencia_externa,
      observacion: liq.observacion,
      detalles: detRaw,
    };
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ReservaStock } from './reserva-stock.entity';
import { ReservarStockDto } from './dto/reservar-stock.dto';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';
import { ConfirmarReservaDto } from './dto/confirmar-reserva.dto';

@Injectable()
export class ReservasService {
  constructor(
    @InjectRepository(ReservaStock)
    private readonly repo: Repository<ReservaStock>,
    private readonly ds: DataSource,
  ) {}

  // =====================================================
  // =============== 1) RESERVAR STOCK ===================
  // =====================================================
  async reservar(dto: ReservarStockDto) {
    if (Number(dto.cantidad) <= 0) {
      throw new BadRequestException('Cantidad inválida para reservar');
    }

    // Obtener stock real
    const realRow = await this.ds.query(
      `
      SELECT cantidad
      FROM public.stk_stock_actual
      WHERE producto_id = $1
        AND almacen_id = $2
    `,
      [dto.producto_id, dto.almacen_id],
    );

    const stockReal = realRow.length ? Number(realRow[0].cantidad) : 0;

    // Obtener stock reservado
    const resRow = await this.ds.query(
      `
      SELECT SUM(cantidad_reservada) AS reservado
      FROM public.stk_stock_reservado
      WHERE producto_id = $1
        AND almacen_id = $2
        AND estado = 'RESERVADO'
    `,
      [dto.producto_id, dto.almacen_id],
    );

    const stockReservado = Number(resRow[0].reservado || 0);

    const disponible = stockReal - stockReservado;

    if (dto.cantidad > disponible) {
      throw new BadRequestException(
        `Stock insuficiente para reservar. Disponible: ${disponible}`,
      );
    }

    const reserva = this.repo.create({
      producto_id: dto.producto_id,
      almacen_id: dto.almacen_id,
      cantidad_reservada: dto.cantidad.toFixed(4),
      lote_id: dto.lote_id ?? null,
      pedido_id: dto.pedido_id ?? null,
      estado: 'RESERVADO',
    });

    return this.repo.save(reserva);
  }

  // =====================================================
  // =============== 2) CANCELAR RESERVA ==================
  // =====================================================
  async cancelar(dto: CancelarReservaDto) {
    const reserva = await this.repo.findOne({ where: { id: dto.reserva_id } });

    if (!reserva) {
      throw new BadRequestException('Reserva no encontrada');
    }

    reserva.estado = 'CANCELADO';
    return this.repo.save(reserva);
  }

  // =====================================================
  // =============== 3) CONFIRMAR RESERVAS ===============
  // =====================================================
  async confirmar(dto: ConfirmarReservaDto) {
    const reservas = await this.repo.findByIds(dto.reservas_ids);

    if (!reservas.length) {
      throw new BadRequestException('Reservas no encontradas');
    }

    for (const r of reservas) {
      if (r.estado !== 'RESERVADO') {
        throw new BadRequestException(
          `La reserva ${r.id} no está en estado RESERVADO`,
        );
      }

      r.estado = 'CONSUMIDO';
      await this.repo.save(r);
    }

    return { ok: true, reservas_confirmadas: reservas.length };
  }

  // =====================================================
  // =============== 4) LISTAR POR PEDIDO ================
  // =====================================================
  async listarPorPedido(pedido_id: number) {
    return this.repo.find({
      where: { pedido_id, estado: 'RESERVADO' },
    });
  }

  // =====================================================
  // =============== 5) STOCK DISPONIBLE ==================
  // =====================================================
  async stockDisponible(producto_id: number, almacen_id: number) {
    const realRow = await this.ds.query(
      `
      SELECT cantidad
      FROM public.stk_stock_actual
      WHERE producto_id = $1
        AND almacen_id = $2
    `,
      [producto_id, almacen_id],
    );

    const stockReal = realRow.length ? Number(realRow[0].cantidad) : 0;

    const resRow = await this.ds.query(
      `
      SELECT SUM(cantidad_reservada) AS reservado
      FROM public.stk_stock_reservado
      WHERE producto_id = $1
        AND almacen_id = $2
        AND estado = 'RESERVADO'
    `,
      [producto_id, almacen_id],
    );

    const stockReservado = Number(resRow[0].reservado || 0);

    return {
      producto_id,
      almacen_id,
      stock_real: stockReal,
      stock_reservado: stockReservado,
      stock_disponible: stockReal - stockReservado,
    };
  }

  // =====================================================
  // =============== 6) LISTADO GENERAL ==================
  // =====================================================
  async listar() {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  // =====================================================
  // =============== 7) STOCK POR ALMACÉN =================
  // =====================================================
  /**
   * Devuelve TODOS los productos (aunque no tengan stock ni reservas)
   * con stock_real, stock_reservado y stock_disponible, filtrados por almacén.
   */
  async stockPorAlmacen(almacen_id: number) {
    const rows = await this.ds.query(
      `
      SELECT
        p.id                       AS producto_id,
        p.nombre                   AS nombre,
        COALESCE(sa.stock_real, 0) AS stock_real,
        COALESCE(sr.stock_reservado, 0) AS stock_reservado,
        COALESCE(sa.stock_real, 0) - COALESCE(sr.stock_reservado, 0) AS stock_disponible
      FROM public.stk_productos p
      LEFT JOIN (
        SELECT
          producto_id,
          SUM(cantidad)::numeric AS stock_real
        FROM public.stk_stock_actual
        WHERE almacen_id = $1
        GROUP BY producto_id
      ) sa ON sa.producto_id = p.id
      LEFT JOIN (
        SELECT
          producto_id,
          SUM(cantidad_reservada)::numeric AS stock_reservado
        FROM public.stk_stock_reservado
        WHERE almacen_id = $1
          AND estado = 'RESERVADO'
        GROUP BY producto_id
      ) sr ON sr.producto_id = p.id
      ORDER BY p.nombre ASC
      `,
      [almacen_id],
    );

    // Normalizo tipos a number
    return rows.map((r: any) => ({
      producto_id: Number(r.producto_id),
      nombre: r.nombre,
      stock_real: Number(r.stock_real || 0),
      stock_reservado: Number(r.stock_reservado || 0),
      stock_disponible: Number(r.stock_disponible || 0),
    }));
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RecibirTransferenciaDto } from './dto/recibir-transferencia.dto';
import { TransferenciaPendiente } from './entities/transferencia-pendiente.entity';
import { MovimientoStock } from '../movimientos/entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from '../movimientos/entities/movimiento-stock-detalle.entity';
import { MovimientoTipo } from '../enums/movimiento-tipo.enum';

@Injectable()
export class TransferenciasPendientesService {
  constructor(private readonly ds: DataSource) {}

  /**
   * Listar tareas pendientes de recepción
   */
  async pendientes(almacen_id?: number) {
    let sql = `
      SELECT *
      FROM stk_transferencias_pendientes
      WHERE completado = false
    `;
    const params: any[] = [];

    if (almacen_id) {
      sql += ` AND almacen_destino_id = $1`;
      params.push(almacen_id);
    }

    sql += ` ORDER BY created_at ASC`;

    return await this.ds.query(sql, params);
  }

  /**
   * Confirmar recepción en almacén destino
   */
  async recibir(dto: RecibirTransferenciaDto) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const pendRows = await qr.query(
        `SELECT * FROM stk_transferencias_pendientes WHERE id = $1 FOR UPDATE`,
        [dto.pendiente_id],
      );

      if (!pendRows.length)
        throw new BadRequestException('Transferencia pendiente no encontrada');

      const p = pendRows[0];

      if (p.completado)
        throw new BadRequestException('Esta transferencia ya fue recibida');

      const enviada = Number(p.cantidad_enviada);
      const recibida = Number(dto.cantidad_recibida);
      const diferencia = Number((recibida - enviada).toFixed(4));

      /** 1) Actualizar pendiente */
      await qr.query(
        `
        UPDATE stk_transferencias_pendientes
        SET cantidad_recibida = $1,
            completado = true,
            fecha_recepcion = now(),
            observacion = $2
        WHERE id = $3
      `,
        [recibida, dto.observacion ?? null, dto.pendiente_id],
      );

      /** 2) Si falta mercadería → generar MERMA automática */
      if (diferencia < 0) {
        const merma = Math.abs(diferencia);

        const mov = await qr.manager.save(
          qr.manager.create(MovimientoStock, {
            tipo: MovimientoTipo.MERMA,
            fecha: new Date(),
            almacen_origen_id: p.almacen_destino_id,
            referencia_tipo: 'CONTROL_RECEPCION',
            referencia_id: p.movimiento_id,
            observacion:
              dto.observacion || 'Faltante detectado en la recepción',
          }),
        );

        const det = qr.manager.create(MovimientoStockDetalle, {
          movimiento: mov,
          producto_id: p.producto_id,
          lote_id: p.lote_id,
          cantidad: merma.toFixed(4),
          efecto: -1,
        });
        await qr.manager.save(det);

        await qr.query(
          `
          UPDATE stk_stock_actual
          SET cantidad = cantidad - $1
          WHERE producto_id = $2 AND almacen_id = $3
        `,
          [merma, p.producto_id, p.almacen_destino_id],
        );

        // bajar lote disponible
        await qr.query(
          `
          UPDATE stk_lote_almacen
          SET cantidad_disponible = cantidad_disponible - $1
          WHERE lote_id = $2 AND almacen_id = $3
        `,
          [merma, p.lote_id, p.almacen_destino_id],
        );
      }

      await qr.commitTransaction();
      return { ok: true };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}

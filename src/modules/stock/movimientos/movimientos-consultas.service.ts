import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { MovimientoStock } from './entities/movimiento-stock.entity';
import { QueryMovimientosDto } from './dto/query-movimientos.dto';
import { QueryVentasProductoDto } from './dto/query-ventas-producto.dto';
import { MovimientoTipo } from '../enums/movimiento-tipo.enum';

@Injectable()
export class MovimientosConsultasService {
  constructor(private readonly ds: DataSource) {}

  async listar(q: QueryMovimientosDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;
    const order = (q.order ?? 'DESC') as 'ASC' | 'DESC';

    const repo = this.ds.getRepository(MovimientoStock);
    const qb = repo.createQueryBuilder('m');

    if (q.tipo) qb.andWhere('m.tipo = :tipo', { tipo: q.tipo });
    if (q.almacen_origen_id)
      qb.andWhere('m.almacen_origen_id = :ao', { ao: q.almacen_origen_id });
    if (q.almacen_destino_id)
      qb.andWhere('m.almacen_destino_id = :ad', {
        ad: q.almacen_destino_id,
      });
    if (q.referencia_tipo)
      qb.andWhere('m.referencia_tipo = :rt', { rt: q.referencia_tipo });
    if (q.referencia_id)
      qb.andWhere('m.referencia_id = :rid', { rid: q.referencia_id });
    if (q.search) {
      qb.andWhere('m.observacion ILIKE :s', { s: `%${q.search}%` });
    }
    if (q.desde) qb.andWhere('m.fecha >= :desde', { desde: new Date(q.desde) });
    if (q.hasta) qb.andWhere('m.fecha < :hasta', { hasta: new Date(q.hasta) });

    // filtro por producto usando EXISTS para no traer todos los detalles
    if (q.producto_id) {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM public.stk_movimientos_det d
           WHERE d.movimiento_id = m.id
             AND d.producto_id = :pid
         )`,
        { pid: q.producto_id },
      );
    }

    qb.orderBy('m.fecha', order).addOrderBy('m.id', order);
    qb.skip(skip).take(limit);

    const [movs, total] = await qb.getManyAndCount();

    // Traer nombres de productos involucrados en esos movimientos
    const ids = movs.map((m) => m.id);
    let productosPorMov: Record<
      string,
      { producto_id: number; producto_nombre: string }[]
    > = {};

    if (ids.length) {
      const rows = await this.ds
        .createQueryBuilder()
        .from('stk_movimientos_det', 'd')
        .innerJoin('stk_productos', 'p', 'p.id = d.producto_id')
        .select([
          'd.movimiento_id AS movimiento_id',
          'd.producto_id   AS producto_id',
          'p.nombre        AS producto_nombre',
        ])
        .where('d.movimiento_id IN (:...ids)', { ids })
        .getRawMany();

      productosPorMov = rows.reduce((acc, r: any) => {
        const key = r.movimiento_id;
        if (!acc[key]) acc[key] = [];
        // evitar duplicados del mismo producto
        if (!acc[key].some((x) => x.producto_id === r.producto_id)) {
          acc[key].push({
            producto_id: r.producto_id,
            producto_nombre: r.producto_nombre,
          });
        }
        return acc;
      }, {} as any);
    }

    const data = movs.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      fecha: m.fecha,
      almacen_origen_id: m.almacen_origen_id,
      almacen_destino_id: m.almacen_destino_id,
      referencia_tipo: m.referencia_tipo,
      referencia_id: m.referencia_id,
      observacion: m.observacion,
      productos: productosPorMov[m.id] ?? [],
    }));

    return { data, total, page, limit };
  }

  async detalle(id: string) {
    const mov = await this.ds
      .getRepository(MovimientoStock)
      .findOne({ where: { id } });

    if (!mov) {
      throw new NotFoundException('Movimiento no encontrado');
    }

    const detalles = await this.ds
      .createQueryBuilder()
      .from('stk_movimientos_det', 'd')
      .leftJoin('stk_productos', 'p', 'p.id = d.producto_id')
      .leftJoin('stk_lotes', 'l', 'l.id = d.lote_id')
      .select([
        'd.id           AS detalle_id',
        'd.producto_id  AS producto_id',
        'p.nombre       AS producto_nombre',
        'd.lote_id      AS lote_id',
        'l.fecha_remito AS lote_fecha_remito',
        'd.cantidad     AS cantidad',
        'd.efecto       AS efecto',
      ])
      .where('d.movimiento_id = :id', { id })
      .orderBy('d.id', 'ASC')
      .getRawMany();

    return {
      id: mov.id,
      tipo: mov.tipo,
      fecha: mov.fecha,
      almacen_origen_id: mov.almacen_origen_id,
      almacen_destino_id: mov.almacen_destino_id,
      referencia_tipo: mov.referencia_tipo,
      referencia_id: mov.referencia_id,
      observacion: mov.observacion,
      detalles,
    };
  }

  async ventasPorProducto(q: QueryVentasProductoDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const offset = (page - 1) * limit;

    const params: any = {
      tipo: MovimientoTipo.VENTA,
      desde: new Date(q.desde),
      hasta: new Date(q.hasta),
    };

    let where = `
      m.tipo = :tipo
      AND m.fecha >= :desde
      AND m.fecha < :hasta
      AND d.efecto = -1
    `;

    if (q.almacen_id) {
      where += ' AND m.almacen_origen_id = :alm';
      params.alm = q.almacen_id;
    }

    if (q.producto_id) {
      where += ' AND d.producto_id = :pid';
      params.pid = q.producto_id;
    }

    // listado agregado
    const listQb = this.ds
      .createQueryBuilder()
      .from('stk_movimientos_det', 'd')
      .innerJoin('stk_movimientos', 'm', 'm.id = d.movimiento_id')
      .innerJoin('stk_productos', 'p', 'p.id = d.producto_id')
      .select([
        'd.producto_id                         AS producto_id',
        'p.nombre                              AS producto_nombre',
        'p.codigo_comercial                    AS producto_codigo_comercial',
        'p.unidad_id                           AS unidad_id',
        'm.almacen_origen_id                   AS almacen_id',
        'SUM(d.cantidad)                       AS cantidad_vendida',
        'COUNT(DISTINCT m.id)                  AS cantidad_movimientos',
      ])
      .where(where, params)
      .groupBy('d.producto_id')
      .addGroupBy('p.nombre')
      .addGroupBy('p.codigo_comercial')
      .addGroupBy('p.unidad_id')
      .addGroupBy('m.almacen_origen_id')
      .orderBy('cantidad_vendida', 'DESC')
      .limit(limit)
      .offset(offset);

    const data = await listQb.getRawMany();

    // total de grupos (producto + almacén) para paginación
    const totalRow = await this.ds
      .createQueryBuilder()
      .from('stk_movimientos_det', 'd')
      .innerJoin('stk_movimientos', 'm', 'm.id = d.movimiento_id')
      .where(where, params)
      .select(
        `COUNT(DISTINCT d.producto_id::text || '-' || COALESCE(m.almacen_origen_id::text,''))`,
        'c',
      )
      .getRawOne();

    const total = Number(totalRow?.c || 0);

    return {
      data: data.map((r: any) => ({
        producto_id: Number(r.producto_id),
        producto_nombre: r.producto_nombre,
        producto_codigo_comercial: r.producto_codigo_comercial,
        unidad_id: r.unidad_id ? Number(r.unidad_id) : null,
        almacen_id: r.almacen_id ? Number(r.almacen_id) : null,
        cantidad_vendida: Number(r.cantidad_vendida),
        cantidad_movimientos: Number(r.cantidad_movimientos),
      })),
      total,
      page,
      limit,
      desde: q.desde,
      hasta: q.hasta,
    };
  }
}

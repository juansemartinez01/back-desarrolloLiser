import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StockLote } from './entities/stock-lote.entity';
import { LoteAlmacen } from './entities/lote-almacen.entity';
import { Producto } from './productos/entities/producto.entity';
import { Unidad } from './productos/entities/unidad.entity';
import { TipoProducto } from './productos/entities/tipo-producto.entity';
import { RemitoItem } from './entities/remito-item.entity';
import { Remito } from './entities/remito.entity';
import { QueryLotesFisicosDto } from './dto/query-lotes-fisicos.dto';

@Injectable()
export class LotesFisicosService {
  constructor(private readonly ds: DataSource) {}

  /**
   * Listado de lotes físicos con datos de producto, unidad y tipo.
   */
  async listar(q: QueryLotesFisicosDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.ds
      .getRepository(StockLote)
      .createQueryBuilder('l')
      .leftJoin(Producto, 'p', 'p.id = l.producto_id')
      .leftJoin(Unidad, 'u', 'u.id = p.unidad_id')
      .leftJoin(TipoProducto, 'tp', 'tp.id = p.tipo_producto_id');

    // Filtros
    if (q.producto_id) {
      qb.andWhere('l.producto_id = :pid', { pid: q.producto_id });
    }

    if (q.solo_con_stock) {
      qb.andWhere('l.cantidad_disponible > 0');
    }

    if (q.almacen_id) {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM public.stk_lote_almacen la
           WHERE la.lote_id = l.id
             AND la.almacen_id = :alm
             AND la.cantidad_disponible > 0
         )`,
        { alm: q.almacen_id },
      );
    }

    // Subselect: cantidad en el almacén filtrado (o total si no hay filtro)
    const cantidadEnAlmacenExpr = q.almacen_id
      ? `(SELECT COALESCE(SUM(la.cantidad_disponible),0)
          FROM public.stk_lote_almacen la
         WHERE la.lote_id = l.id
           AND la.almacen_id = :alm_sub)`
      : `(SELECT COALESCE(SUM(la.cantidad_disponible),0)
          FROM public.stk_lote_almacen la
         WHERE la.lote_id = l.id)`;

    if (q.almacen_id) {
      qb.setParameter('alm_sub', q.almacen_id);
    }

    qb.select([
      'l.id AS lote_id',
      'l.fecha_remito AS fecha_remito',
      'l.cantidad_inicial AS cantidad_inicial',
      'l.cantidad_disponible AS cantidad_disponible',
      'l.bloqueado AS bloqueado',

      'p.id AS producto_id',
      'p.nombre AS producto_nombre',
      'p.codigo_comercial AS producto_codigo_comercial',

      'u.id AS unidad_id',
      'u.codigo AS unidad_codigo',
      'u.nombre AS unidad_nombre',

      'tp.id AS tipo_producto_id',
      'tp.nombre AS tipo_producto_nombre',

      `${cantidadEnAlmacenExpr} AS cantidad_en_almacen`,
    ])
      .orderBy('l.fecha_remito', 'DESC')
      .addOrderBy('p.nombre', 'ASC')
      .offset(skip)
      .limit(limit);

    const data = await qb.getRawMany();

    // Total para paginación (mismos filtros pero COUNT)
    const countQb = this.ds.getRepository(StockLote).createQueryBuilder('l');

    if (q.producto_id) {
      countQb.andWhere('l.producto_id = :pid', { pid: q.producto_id });
    }
    if (q.solo_con_stock) {
      countQb.andWhere('l.cantidad_disponible > 0');
    }
    if (q.almacen_id) {
      countQb.andWhere(
        `EXISTS (
           SELECT 1 FROM public.stk_lote_almacen la
           WHERE la.lote_id = l.id
             AND la.almacen_id = :alm
             AND la.cantidad_disponible > 0
         )`,
        { alm: q.almacen_id },
      );
    }

    const total = await countQb.getCount();

    return { data, total, page, limit };
  }

  /**
   * Detalle de un lote físico: datos del lote, producto, remito e
   * información por almacén.
   */
  async detalle(id: string) {
    // Info principal del lote + producto + remito
    const info = await this.ds
      .getRepository(StockLote)
      .createQueryBuilder('l')
      .leftJoin(RemitoItem, 'ri', 'ri.id = l.remito_item_id')
      .leftJoin(Remito, 'r', 'r.id = ri.remito_id')
      .leftJoin(Producto, 'p', 'p.id = l.producto_id')
      .leftJoin(Unidad, 'u', 'u.id = p.unidad_id')
      .leftJoin(TipoProducto, 'tp', 'tp.id = p.tipo_producto_id')
      .select([
        'l.id AS lote_id',
        'l.fecha_remito AS fecha_remito',
        'l.cantidad_inicial AS cantidad_inicial',
        'l.cantidad_disponible AS cantidad_disponible',
        'l.bloqueado AS bloqueado',

        'p.id AS producto_id',
        'p.nombre AS producto_nombre',
        'p.codigo_comercial AS producto_codigo_comercial',
        'p.descripcion AS producto_descripcion',

        'u.id AS unidad_id',
        'u.codigo AS unidad_codigo',
        'u.nombre AS unidad_nombre',

        'tp.id AS tipo_producto_id',
        'tp.nombre AS tipo_producto_nombre',

        'ri.id AS remito_item_id',
        'ri.cantidad_total AS remito_item_cantidad_total',
        'ri.cantidad_remito AS remito_item_cantidad_remito',
        'ri.empresa_factura AS remito_item_empresa_factura',

        'r.id AS remito_id',
        'r.fecha_remito AS remito_fecha',
        'r.numero_remito AS remito_numero',
        'r.proveedor_id AS remito_proveedor_id',
        'r.proveedor_nombre AS remito_proveedor_nombre',
      ])
      .where('l.id = :id', { id })
      .getRawOne();

    if (!info) {
      throw new NotFoundException('Lote físico no encontrado');
    }

    // Distribución por almacén
    const en_almacenes = await this.ds
      .getRepository(LoteAlmacen)
      .createQueryBuilder('la')
      .select([
        'la.id AS id',
        'la.almacen_id AS almacen_id',
        'la.cantidad_asignada AS cantidad_asignada',
        'la.cantidad_disponible AS cantidad_disponible',
        'la.created_at AS created_at',
        'la.updated_at AS updated_at',
      ])
      .where('la.lote_id = :id', { id })
      .orderBy('la.almacen_id', 'ASC')
      .getRawMany();

    return {
      info,
      en_almacenes,
    };
  }
}

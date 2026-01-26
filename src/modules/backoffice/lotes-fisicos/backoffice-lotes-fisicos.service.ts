import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import { LoteAlmacen } from '../../stock/lotes-fisicos/entities/lote-almacen.entity'; // ajustá path
import { Producto } from '../../stock/productos/entities/producto.entity';
import { Unidad } from '../../stock/productos/entities/unidad.entity';
import { TipoProducto } from '../../stock/productos/entities/tipo-producto.entity';
import { RemitoItem } from '../../stock/remitos/entities/remito-item.entity';
import { Remito } from '../../stock/remitos/entities/remito.entity';

import { QueryBackofficeLotesFisicosDto } from './dto/query-backoffice-lotes-fisicos.dto';
import { StockLote } from '../../../modules/stock/stock-actual/entities/stock-lote.entity';

@Injectable()
export class BackofficeLotesFisicosService {
  constructor(private readonly ds: DataSource) {}

  private applyLoteFilters<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    q: QueryBackofficeLotesFisicosDto,
  ) {
    if (q.id) qb.andWhere('l.id = :id', { id: q.id });

    if (q.created_desde)
      qb.andWhere('l.created_at >= :cd', { cd: q.created_desde });
    if (q.created_hasta)
      qb.andWhere('l.created_at <= :ch', { ch: q.created_hasta });

    if (q.updated_desde)
      qb.andWhere('l.updated_at >= :ud', { ud: q.updated_desde });
    if (q.updated_hasta)
      qb.andWhere('l.updated_at <= :uh', { uh: q.updated_hasta });

    if (q.version !== undefined)
      qb.andWhere('l.version = :v', { v: q.version });
    if (q.version_desde !== undefined)
      qb.andWhere('l.version >= :vd', { vd: q.version_desde });
    if (q.version_hasta !== undefined)
      qb.andWhere('l.version <= :vh', { vh: q.version_hasta });

    if (q.producto_id)
      qb.andWhere('l.producto_id = :pid', { pid: q.producto_id });

    if (q.bloqueado !== undefined)
      qb.andWhere('l.bloqueado = :bloq', { bloq: q.bloqueado });

    if (q.solo_con_stock) qb.andWhere('l.cantidad_disponible > 0');

    if (q.fecha_desde)
      qb.andWhere('l.fecha_remito >= :fd', { fd: q.fecha_desde });
    if (q.fecha_hasta)
      qb.andWhere('l.fecha_remito <= :fh', { fh: q.fecha_hasta });

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

    return qb;
  }

  async listar(q: QueryBackofficeLotesFisicosDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.ds
      .getRepository(StockLote)
      .createQueryBuilder('l')
      .leftJoin(Producto, 'p', 'p.id = l.producto_id')
      .leftJoin(Unidad, 'u', 'u.id = p.unidad_id')
      .leftJoin(TipoProducto, 'tp', 'tp.id = p.tipo_producto_id');

    this.applyLoteFilters(qb, q);

    const cantidadEnAlmacenExpr = q.almacen_id
      ? `(SELECT COALESCE(SUM(la.cantidad_disponible),0)
         FROM public.stk_lote_almacen la
         WHERE la.lote_id = l.id
           AND la.almacen_id = :alm_sub)`
      : `(SELECT COALESCE(SUM(la.cantidad_disponible),0)
         FROM public.stk_lote_almacen la
         WHERE la.lote_id = l.id)`;

    if (q.almacen_id) qb.setParameter('alm_sub', q.almacen_id);

    qb.select([
      'l.id AS lote_id',
      'l.fecha_remito AS fecha_remito',
      'l.cantidad_inicial AS cantidad_inicial',
      'l.cantidad_disponible AS cantidad_disponible',
      'l.bloqueado AS bloqueado',
      'l.created_at AS created_at',
      'l.updated_at AS updated_at',
      'l.version AS version',

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
      .addOrderBy('l.created_at', 'DESC')
      .offset(skip)
      .limit(limit);

    const data = await qb.getRawMany();

    const countQb = this.ds.getRepository(StockLote).createQueryBuilder('l');
    this.applyLoteFilters(countQb, q);
    const total = await countQb.getCount();

    return { data, total, page, limit };
  }

  async detalle(id: string) {
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

    if (!info) throw new NotFoundException('Lote físico no encontrado');

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

    return { info, en_almacenes };
  }

  async listarFisicosSinContable() {
    const qb = this.ds
      .getRepository(StockLote)
      .createQueryBuilder('l')
      .leftJoin('stk_lotes_contables', 'lc', 'lc.lote_id = l.id')
      .innerJoin(Producto, 'p', 'p.id = l.producto_id')
      .leftJoin(Unidad, 'u', 'u.id = p.unidad_id')
      .leftJoin(TipoProducto, 'tp', 'tp.id = p.tipo_producto_id')
      .where('lc.lote_id IS NULL')
      .orderBy('l.fecha_remito', 'ASC')
      .addOrderBy('l.created_at', 'ASC');

    const rows = await qb
      .select([
        'l.id AS lote_id',
        'l.producto_id AS producto_id',
        'l.fecha_remito AS fecha_remito',
        'l.cantidad_inicial AS cantidad_inicial',
        'l.cantidad_disponible AS cantidad_disponible',
        'l.bloqueado AS bloqueado',
        'p.nombre AS producto_nombre',
        'p.codigo_comercial AS codigo_comercial',
        'u.codigo AS unidad_codigo',
        'u.nombre AS unidad_nombre',
        'tp.nombre AS tipo_producto_nombre',
      ])
      .getRawMany();

    return { data: rows };
  }
}

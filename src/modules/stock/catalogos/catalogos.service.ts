// src/modules/stock/catalogos/catalogos.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryCatalogoDto } from '../dto/query-catalogo.dto';

@Injectable()
export class CatalogosService {
  constructor(private readonly ds: DataSource) {}

  private normPageLimit(q: QueryCatalogoDto) {
    const page = q.page && q.page > 0 ? q.page : 1;
    const limit = q.limit && q.limit > 0 ? q.limit : 50;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  // ---------- PROVEEDORES ----------
  async listarProveedores(q: QueryCatalogoDto) {
    const { page, limit, skip } = this.normPageLimit(q);
    const search = q.search?.trim();

    const listQb = this.ds
      .createQueryBuilder()
      .from('fin_proveedores', 'p')
      .select(['p.id AS id', 'p.nombre AS nombre'])
      .where('p.activo = true');

    if (search) {
      listQb.andWhere('unaccent(p.nombre) ILIKE unaccent(:search)', {
        search: `%${search}%`,
      });
    }

    listQb.orderBy('p.nombre', 'ASC').limit(limit).offset(skip);

    const rows = await listQb.getRawMany();

    const countQb = this.ds
      .createQueryBuilder()
      .from('fin_proveedores', 'p')
      .select('COUNT(1)', 'c')
      .where('p.activo = true');

    if (search) {
      countQb.andWhere('unaccent(p.nombre) ILIKE unaccent(:search)', {
        search: `%${search}%`,
      });
    }

    const total = await countQb.getRawOne().then((r: any) => Number(r?.c) || 0);

    return { data: rows, total, page, limit };
  }

  // ---------- CONDUCTORES ----------
  async listarConductores(q: QueryCatalogoDto) {
    const { page, limit, skip } = this.normPageLimit(q);
    const search = q.search?.trim();

    const listQb = this.ds
      .createQueryBuilder()
      .from('stk_conductores_camion', 'c')
      .select(['c.id AS id', 'c.nombre AS nombre'])
      .where('c.activo = true');

    if (search) {
      listQb.andWhere('unaccent(c.nombre) ILIKE unaccent(:search)', {
        search: `%${search}%`,
      });
    }

    listQb.orderBy('c.nombre', 'ASC').limit(limit).offset(skip);

    const rows = await listQb.getRawMany();

    const countQb = this.ds
      .createQueryBuilder()
      .from('stk_conductores_camion', 'c')
      .select('COUNT(1)', 'c')
      .where('c.activo = true');

    if (search) {
      countQb.andWhere('unaccent(c.nombre) ILIKE unaccent(:search)', {
        search: `%${search}%`,
      });
    }

    const total = await countQb.getRawOne().then((r: any) => Number(r?.c) || 0);

    return { data: rows, total, page, limit };
  }
}

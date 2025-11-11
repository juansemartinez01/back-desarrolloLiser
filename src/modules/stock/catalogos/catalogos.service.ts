// src/modules/stock/catalogos/catalogos.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryCatalogoDto } from '../dto/query-catalogo.dto';

@Injectable()
export class CatalogosService {
  constructor(private readonly ds: DataSource) {}

  async listarProveedores(q: QueryCatalogoDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const offset = (page - 1) * limit;
    const search = q.q?.trim();

    // 👇 ajustá el nombre de la tabla/columnas a tu maestro real
    const params: any[] = [];
    let where = '1=1';
    if (search) {
      params.push(`%${search}%`);
      where = 'p.nombre ILIKE $1';
    }

    const rows = await this.ds.query(
      `
      SELECT p.id, p.nombre
      FROM public.proveedores p
      WHERE ${where}
      ORDER BY p.nombre ASC
      LIMIT $2 OFFSET $3
      `,
      [...params, limit, offset],
    );

    const totalRow = await this.ds
      .query(
        `
        SELECT COUNT(1) AS c
        FROM public.proveedores p
        WHERE ${where}
        `,
        params,
      )
      .then((r) => Number(r[0]?.c || 0));

    return { data: rows, total: totalRow, page, limit };
  }

  async listarConductores(q: QueryCatalogoDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const offset = (page - 1) * limit;
    const search = q.q?.trim();

    const params: any[] = [];
    let where = 'c.activo = true';
    if (search) {
      params.push(`%${search}%`);
      where += ' AND c.nombre ILIKE $1';
    }

    const rows = await this.ds.query(
      `
      SELECT c.id, c.nombre
      FROM public.stk_conductores_camion c
      WHERE ${where}
      ORDER BY c.nombre ASC
      LIMIT $2 OFFSET $3
      `,
      [...params, limit, offset],
    );

    const totalRow = await this.ds
      .query(
        `
        SELECT COUNT(1) AS c
        FROM public.stk_conductores_camion c
        WHERE ${where}
        `,
        params,
      )
      .then((r) => Number(r[0]?.c || 0));

    return { data: rows, total: totalRow, page, limit };
  }
}

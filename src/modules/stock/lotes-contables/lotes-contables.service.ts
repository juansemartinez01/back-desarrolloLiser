// src/modules/stock/lotes-contables/lotes-contables.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoteContable } from './entities/lote-contable.entity';
import { StockLote } from '../stock-actual/entities/stock-lote.entity';
import {
  CreateLoteContableDto,
  UpdateLoteContableDto,
  QueryLoteContableDto,
} from './dto/lote-contable.dto';
import { LoteContableEstado } from '../enums/lote-contable-estado.enum';
import { QueryTipo1Dto } from './dto/query-tipo1.dto';

function toDecimal4(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(4);
}

function resolverEstado(total: number, vendida: number): LoteContableEstado {
  if (vendida <= 0 + 1e-9) return LoteContableEstado.SIN_VENDER;
  if (vendida >= total - 1e-9) return LoteContableEstado.VENDIDO;
  return LoteContableEstado.PARCIAL;
}

@Injectable()
export class LotesContablesService {
  private readonly logger = new Logger(LotesContablesService.name);
  constructor(private readonly ds: DataSource) {}

  // LISTAR con filtros
  async listar(q: QueryLoteContableDto) {
    try {
      const page = q.page ?? 1;
      const limit = q.limit ?? 50;
      const skip = (page - 1) * limit;

      const repo = this.ds.getRepository(LoteContable);
      const qb = repo.createQueryBuilder('lc');

      if (q.lote_id) {
        qb.andWhere('lc.lote_id = :lid', { lid: q.lote_id });
      }
      if (q.estado) {
        qb.andWhere('lc.estado = :e', { e: q.estado });
      }

      qb.orderBy('lc.created_at', 'DESC').skip(skip).take(limit);

      const [data, total] = await qb.getManyAndCount();
      return { data, total, page, limit };
    } catch (e: any) {
      this.logger.error(
        '[GET /stock/lotes-contables] error',
        e?.stack || String(e),
      );
      throw new BadRequestException(
        e?.detail || e?.message || 'Error listando lotes contables',
      );
    }
  }

  // OBTENER por id
  async obtener(id: string) {
    try {
      const lc = await this.ds
        .getRepository(LoteContable)
        .findOne({ where: { id } });
      if (!lc) throw new NotFoundException('Lote contable no encontrado');
      return lc;
    } catch (e: any) {
      this.logger.error(
        `[GET /stock/lotes-contables/${id}] error`,
        e?.stack || String(e),
      );
      throw new BadRequestException(
        e?.detail || e?.message || 'Error obteniendo lote contable',
      );
    }
  }
  // CREAR (uno por lote físico)
  async crear(dto: CreateLoteContableDto) {
    const loteRepo = this.ds.getRepository(StockLote);
    const contRepo = this.ds.getRepository(LoteContable);

    const lote = await loteRepo.findOne({ where: { id: dto.lote_id } });
    if (!lote) {
      throw new BadRequestException(`El lote físico ${dto.lote_id} no existe`);
    }

    const yaExiste = await contRepo.findOne({
      where: { lote_id: dto.lote_id },
    });
    if (yaExiste) {
      throw new BadRequestException(
        `Ya existe un lote contable para el lote ${dto.lote_id}`,
      );
    }

    const total = Number(dto.cantidad_total);
    const t1 = Number(dto.cantidad_tipo1);
    const t2 = Number(dto.cantidad_tipo2);

    if (Number(toDecimal4(t1 + t2)) !== Number(toDecimal4(total))) {
      throw new BadRequestException(
        'cantidad_tipo1 + cantidad_tipo2 debe igualar cantidad_total',
      );
    }

    const vendida = Number(dto.cantidad_vendida ?? 0);
    if (vendida < 0 || vendida - total > 1e-9) {
      throw new BadRequestException(
        'cantidad_vendida debe estar entre 0 y cantidad_total',
      );
    }

    const estado = resolverEstado(total, vendida);

    const lc = contRepo.create({
      lote: lote,
      lote_id: lote.id,
      cantidad_total: toDecimal4(total),
      cantidad_tipo1: toDecimal4(t1),
      cantidad_tipo2: toDecimal4(t2),
      cantidad_vendida: toDecimal4(vendida),
      empresa_factura: dto.empresa_factura,
      estado,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return contRepo.save(lc);
  }

  // ACTUALIZAR
  async actualizar(id: string, dto: UpdateLoteContableDto) {
    const repo = this.ds.getRepository(LoteContable);
    const lc = await repo.findOne({ where: { id } });
    if (!lc) throw new NotFoundException('Lote contable no encontrado');

    let total = Number(lc.cantidad_total);
    let t1 = Number(lc.cantidad_tipo1);
    let t2 = Number(lc.cantidad_tipo2);
    let vendida = Number(lc.cantidad_vendida);

    if (dto.cantidad_total != null) total = Number(dto.cantidad_total);
    if (dto.cantidad_tipo1 != null) t1 = Number(dto.cantidad_tipo1);
    if (dto.cantidad_tipo2 != null) t2 = Number(dto.cantidad_tipo2);
    if (dto.cantidad_vendida != null) vendida = Number(dto.cantidad_vendida);

    if (Number(toDecimal4(t1 + t2)) !== Number(toDecimal4(total))) {
      throw new BadRequestException(
        'cantidad_tipo1 + cantidad_tipo2 debe igualar cantidad_total',
      );
    }

    if (vendida < 0 || vendida - total > 1e-9) {
      throw new BadRequestException(
        'cantidad_vendida debe estar entre 0 y cantidad_total',
      );
    }

    lc.cantidad_total = toDecimal4(total);
    lc.cantidad_tipo1 = toDecimal4(t1);
    lc.cantidad_tipo2 = toDecimal4(t2);
    lc.cantidad_vendida = toDecimal4(vendida);
    lc.estado = resolverEstado(total, vendida);

    if (dto.empresa_factura != null) {
      lc.empresa_factura = dto.empresa_factura as any;
    }

    lc.updated_at = new Date();

    return repo.save(lc);
  }

  // Opcional: podrías permitir "borrado lógico" si lo necesitás.
  async borrar(id: string) {
    const repo = this.ds.getRepository(LoteContable);
    const lc = await repo.findOne({ where: { id } });
    if (!lc) throw new NotFoundException('Lote contable no encontrado');

    await repo.remove(lc);
    return { ok: true };
  }

  async productosConTipo1Extendido(q: QueryTipo1Dto) {
    const qb = this.ds
      .getRepository(LoteContable)
      .createQueryBuilder('lc')
      .innerJoin(StockLote, 'l', 'l.id = lc.lote_id')
      .innerJoin('stk_productos', 'p', 'p.id = l.producto_id')
      .leftJoin('stk_unidades', 'u', 'u.id = p.unidad_id')
      .leftJoin('stk_tipos_producto', 'tp', 'tp.id = p.tipo_producto_id')
      .select([
        'p.id AS producto_id',
        'p.nombre AS producto_nombre',
        'p.codigo_comercial AS producto_codigo_comercial',

        'u.codigo AS unidad_codigo',
        'u.nombre AS unidad_nombre',

        'tp.id AS tipo_producto_id',
        'tp.nombre AS tipo_producto',

        // SUM tipo1
        'SUM(CAST(lc.cantidad_tipo1 AS numeric)) AS cantidad_tipo1_total',

        // SUM facturada
        'SUM(CAST(lc.cantidad_facturada AS numeric)) AS cantidad_facturada_total',

        // pendiente = tipo1 - facturada
        '(SUM(CAST(lc.cantidad_tipo1 AS numeric)) - SUM(CAST(lc.cantidad_facturada AS numeric))) AS pendiente_facturar',
      ])
      .groupBy('p.id')
      .addGroupBy('u.codigo')
      .addGroupBy('u.nombre')
      .addGroupBy('tp.id')
      .addGroupBy('tp.nombre')
      .having(
        '(SUM(CAST(lc.cantidad_tipo1 AS numeric)) - SUM(CAST(lc.cantidad_facturada AS numeric))) > 0',
      )
      .orderBy('p.nombre', 'ASC');

    // ==== FILTROS ====
    if (q.producto_id) {
      qb.andWhere('p.id = :pid', { pid: q.producto_id });
    }

    if (q.tipo_producto_id) {
      qb.andWhere('tp.id = :tpid', { tpid: q.tipo_producto_id });
    }

    if (q.empresa_factura) {
      qb.andWhere('lc.empresa_factura = :ef', { ef: q.empresa_factura });
    }

    if (q.estado) {
      qb.andWhere('lc.estado = :st', { st: q.estado });
    }

    if (q.desde) {
      qb.andWhere('l.fecha_remito >= :desde', { desde: q.desde });
    }

    if (q.hasta) {
      qb.andWhere('l.fecha_remito <= :hasta', { hasta: q.hasta });
    }

    // RESULTADO
    return qb.getRawMany();
  }

  async registrarFacturacion(producto_id: number, cantidad: number) {
    const repo = this.ds.getRepository(LoteContable);

    // Traer todos los lotes contables con tipo1 > facturado
    const lotes = await repo
      .createQueryBuilder('lc')
      .innerJoin(StockLote, 'l', 'l.id = lc.lote_id')
      .where('l.producto_id = :pid', { pid: producto_id })
      .andWhere(
        'CAST(lc.cantidad_tipo1 AS numeric) > CAST(lc.cantidad_facturada AS numeric)',
      )
      .orderBy('l.fecha_remito', 'ASC') // FIFO
      .getMany();

    if (lotes.length === 0) {
      throw new BadRequestException(
        'No hay cantidad tipo1 disponible para facturar',
      );
    }

    let restante = cantidad;

    for (const lote of lotes) {
      if (restante <= 0) break;

      const disponible =
        Number(lote.cantidad_tipo1) - Number(lote.cantidad_facturada);

      const consumir = Math.min(disponible, restante);

      lote.cantidad_facturada = (
        Number(lote.cantidad_facturada) + consumir
      ).toFixed(4);

      // Actualizar estado si es necesario
      const total = Number(lote.cantidad_total);
      const vendida = Number(lote.cantidad_vendida); // ya existe
      lote.estado = resolverEstado(total, vendida); // tu propia lógica

      await repo.save(lote);

      restante -= consumir;
    }

    if (restante > 0) {
      throw new BadRequestException(
        `No hay suficiente cantidad tipo1 para facturar. Faltaron ${restante}`,
      );
    }

    return { ok: true };
  }
}

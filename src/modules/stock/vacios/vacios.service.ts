import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Envase } from './entities/envase.entity';
import {
  MovimientoVacio,
  MovimientoVacioTipo,
} from './entities/movimiento-vacio.entity';
import { SaldoVaciosCliente } from './entities/saldo-vacios-cliente.entity';
import { RegistrarEntregaPedidoDto } from './dto/registrar-entrega-pedido.dto';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { QueryEstadoCuentaVaciosDto } from './dto/query-estado-cuenta-vacios.dto';

function parseBool(v: any, def = true): boolean {
  if (v === true || v === false) return v;
  if (v === null || v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'si'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return def;
}
function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class VaciosService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Envase) private readonly envaseRepo: Repository<Envase>,
  ) {}

  // -----------------------
  // Catálogo envases
  // -----------------------
  async listEnvases() {
    return this.envaseRepo.find({ order: { nombre: 'ASC' } });
  }

  async createEnvase(dto: {
    nombre: string;
    codigo?: string;
    precio_base?: number;
    activo?: boolean;
  }) {
    const e = this.envaseRepo.create({
      nombre: dto.nombre,
      codigo: dto.codigo ?? null,
      precio_base: String(dto.precio_base ?? 0),
      activo: dto.activo ?? true,
    });
    return this.envaseRepo.save(e);
  }

  async updateEnvase(id: number, dto: any) {
    const e = await this.envaseRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Envase no encontrado');
    if (dto.nombre !== undefined) e.nombre = dto.nombre;
    if (dto.codigo !== undefined) e.codigo = dto.codigo ?? null;
    if (dto.precio_base !== undefined)
      e.precio_base = String(dto.precio_base ?? 0);
    if (dto.activo !== undefined) e.activo = !!dto.activo;
    return this.envaseRepo.save(e);
  }

  // -----------------------
  // Impacto vacíos (TX)
  // -----------------------
  async registrarEntregaPedidoTx(
    qr: QueryRunner,
    dto: RegistrarEntregaPedidoDto,
    userId?: number,
  ) {
    if (!dto.items?.length)
      return { ok: true, mensaje: 'Sin vacíos para impactar' };

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

    for (const it of dto.items) {
      if (!(Number(it.cantidad) > 0)) {
        throw new BadRequestException('Cantidad de vacíos inválida');
      }
    }

    const envaseIds = dto.items.map((i) => i.envase_id);
    const envases = await qr.query(
      `select id, precio_base from envase where activo=true and id = any($1::bigint[])`,
      [envaseIds],
    );
    if (envases.length !== envaseIds.length) {
      throw new BadRequestException(
        'Uno o más envases no existen o están inactivos',
      );
    }
    const precioById = new Map<number, number>(
      envases.map((e: any) => [Number(e.id), Number(e.precio_base)]),
    );

    // Inserta movimientos ENTREGA (idempotente por índice unique)
    try {
      for (const it of dto.items) {
        const cant = toNum(it.cantidad);
        const precio = it.precio_unitario ?? precioById.get(it.envase_id) ?? 0;

        await qr.query(
          `
          insert into movimiento_vacio
            (fecha, cliente_id, envase_id, tipo, cantidad, cantidad_firmada, precio_unitario_aplicado,
             ref_tipo, ref_numero, ref_codigo, observacion, created_by, created_at)
          values
            ($1, $2, $3, 'ENTREGA', $4, $4, $5,
             'PEDIDO', $6, $7, null, $8, now())
          `,
          [
            fecha,
            dto.cliente_id,
            it.envase_id,
            cant,
            precio,
            dto.pedido_id,
            dto.pedido_codigo ?? null,
            userId ?? null,
          ],
        );
      }
    } catch (e: any) {
      if (e?.code === '23505') {
        return {
          ok: true,
          mensaje: 'Vacíos ya impactados para este pedido (idempotencia)',
        };
      }
      throw e;
    }

    // Upsert saldos: sumar
    for (const it of dto.items) {
      await qr.query(
        `
        insert into saldo_vacios_cliente (cliente_id, envase_id, saldo_cantidad, updated_at)
        values ($1, $2, $3, now())
        on conflict (cliente_id, envase_id)
        do update set saldo_cantidad = saldo_vacios_cliente.saldo_cantidad + excluded.saldo_cantidad,
                      updated_at = now()
        `,
        [dto.cliente_id, it.envase_id, toNum(it.cantidad)],
      );
    }

    return { ok: true, mensaje: 'Vacíos impactados' };
  }

  async registrarDevolucion(dto: RegistrarDevolucionDto, userId?: number) {
    return this.ds.transaction(async (tx) => {
      const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
      const cant = toNum(dto.cantidad);
      if (cant <= 0) throw new BadRequestException('Cantidad inválida');

      const env = await tx
        .getRepository(Envase)
        .findOne({ where: { id: dto.envase_id, activo: true as any } });
      if (!env)
        throw new BadRequestException('Envase no existe o está inactivo');

      // No permitir saldo negativo
      const s = await tx.query(
        `select saldo_cantidad from saldo_vacios_cliente where cliente_id=$1 and envase_id=$2`,
        [dto.cliente_id, dto.envase_id],
      );
      const saldoActual = toNum(s?.[0]?.saldo_cantidad);
      if (saldoActual - cant < 0) {
        throw new BadRequestException(
          'No se puede devolver más vacíos que el saldo actual',
        );
      }

      await tx.query(
        `
        insert into movimiento_vacio
          (fecha, cliente_id, envase_id, tipo, cantidad, cantidad_firmada, precio_unitario_aplicado,
           ref_tipo, ref_numero, ref_codigo, observacion, created_by, created_at)
        values
          ($1, $2, $3, 'DEVOLUCION', $4, $5, $6,
           null, null, null, $7, $8, now())
        `,
        [
          fecha,
          dto.cliente_id,
          dto.envase_id,
          cant,
          -cant,
          toNum(env.precio_base),
          dto.observacion ?? null,
          userId ?? null,
        ],
      );

      await tx.query(
        `
        update saldo_vacios_cliente
           set saldo_cantidad = saldo_cantidad - $3,
               updated_at = now()
         where cliente_id = $1 and envase_id = $2
        `,
        [dto.cliente_id, dto.envase_id, cant],
      );

      return { ok: true, mensaje: 'Devolución registrada' };
    });
  }

  async saldosCliente(clienteId: number) {
    const rows = await this.ds.query(
      `
      select
        s.envase_id,
        e.nombre,
        e.codigo,
        s.saldo_cantidad,
        e.precio_base,
        (s.saldo_cantidad * e.precio_base) as valor_estimado
      from saldo_vacios_cliente s
      join envase e on e.id = s.envase_id
      where s.cliente_id = $1
      order by e.nombre asc
      `,
      [clienteId],
    );

    const total = rows.reduce(
      (acc: number, r: any) => acc + toNum(r.valor_estimado),
      0,
    );

    return {
      cliente_id: clienteId,
      saldos: rows.map((r: any) => ({
        envase_id: Number(r.envase_id),
        nombre: r.nombre,
        codigo: r.codigo,
        saldo_cantidad: toNum(r.saldo_cantidad),
        precio_base: toNum(r.precio_base),
        valor_estimado: toNum(r.valor_estimado),
      })),
      valor_total_estimado: total,
    };
  }

  async estadoCuenta(q: QueryEstadoCuentaVaciosDto) {
    const includeMovs = parseBool(q.include_movimientos, true);
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;

    const where: string[] = ['m.cliente_id = $1'];
    const args: any[] = [q.cliente_id];
    let i = 2;

    if (q.envase_id) {
      where.push(`m.envase_id = $${i++}`);
      args.push(q.envase_id);
    }
    if (q.desde) {
      where.push(`m.fecha >= $${i++}`);
      args.push(new Date(q.desde));
    }
    if (q.hasta) {
      where.push(`m.fecha <= $${i++}`);
      args.push(new Date(q.hasta));
    }

    // saldo inicial (antes de desde)
    let saldoInicial = 0;
    if (q.desde) {
      const w2: string[] = ['cliente_id = $1', 'fecha < $2'];
      const a2: any[] = [q.cliente_id, new Date(q.desde)];
      let j = 3;
      if (q.envase_id) {
        w2.push(`envase_id = $${j++}`);
        a2.push(q.envase_id);
      }
      const r = await this.ds.query(
        `select coalesce(sum(cantidad_firmada),0) as s from movimiento_vacio where ${w2.join(' and ')}`,
        a2,
      );
      saldoInicial = toNum(r?.[0]?.s);
    }

    // totales período
    const tot = await this.ds.query(
      `
      select
        coalesce(sum(case when tipo='ENTREGA' then cantidad else 0 end),0) as entregas,
        coalesce(sum(case when tipo='DEVOLUCION' then cantidad else 0 end),0) as devoluciones
      from movimiento_vacio m
      where ${where.join(' and ')}
      `,
      args,
    );

    const base = {
      cliente_id: q.cliente_id,
      filtros: {
        desde: q.desde ?? null,
        hasta: q.hasta ?? null,
        envase_id: q.envase_id ?? null,
      },
      saldo_inicial: saldoInicial,
      totales: {
        entregas: toNum(tot?.[0]?.entregas),
        devoluciones: toNum(tot?.[0]?.devoluciones),
      },
    };

    // saldo final (sin paginado)
    const sf = await this.ds.query(
      `select coalesce(sum(cantidad_firmada),0) as s from movimiento_vacio m where ${where.join(' and ')}`,
      args,
    );
    const saldoFinal = saldoInicial + toNum(sf?.[0]?.s);

    if (!includeMovs) {
      return {
        ...base,
        movimientos: [],
        saldo_final: saldoFinal,
        paginacion: { limit, offset, count: 0 },
      };
    }

    const movs = await this.ds.query(
      `
      select
        m.id,
        m.fecha,
        m.tipo,
        m.envase_id,
        e.nombre as envase_nombre,
        e.codigo as envase_codigo,
        m.cantidad,
        m.cantidad_firmada,
        coalesce(m.precio_unitario_aplicado, e.precio_base) as precio_unitario,
        (m.cantidad * coalesce(m.precio_unitario_aplicado, e.precio_base)) as valor_mov,
        m.ref_tipo,
        m.ref_numero,
        m.ref_codigo,
        m.observacion
      from movimiento_vacio m
      join envase e on e.id = m.envase_id
      where ${where.join(' and ')}
      order by m.fecha asc, m.id asc
      limit $${i} offset $${i + 1}
      `,
      [...args, limit, offset],
    );

    let saldo = saldoInicial;
    const movimientos = movs.map((r: any) => {
      saldo += toNum(r.cantidad_firmada);
      return {
        id: r.id,
        fecha: r.fecha,
        tipo: r.tipo,
        envase: {
          id: Number(r.envase_id),
          nombre: r.envase_nombre,
          codigo: r.envase_codigo,
        },
        cantidad: toNum(r.cantidad),
        cantidad_firmada: toNum(r.cantidad_firmada),
        saldo_corrido: saldo,
        precio_unitario: toNum(r.precio_unitario),
        valor_mov: toNum(r.valor_mov),
        ref: r.ref_tipo
          ? {
              tipo: r.ref_tipo,
              numero: r.ref_numero ?? null,
              codigo: r.ref_codigo ?? null,
            }
          : null,
        observacion: r.observacion,
      };
    });

    return {
      ...base,
      movimientos,
      saldo_final: saldoFinal,
      paginacion: { limit, offset, count: movimientos.length },
    };
  }
}

// src/caja/caja.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CajaApertura } from './entities/caja-apertura.entity';
import { CajaMovimiento } from './entities/caja-movimiento.entity';
import { CajaCierre } from './entities/caja-cierre.entity';
import { AperturaDto } from './dto/apertura.dto';
import { MovimientoDto } from './dto/movimiento.dto';
import { CerrarCajaDto } from './dto/cierre.dto';
import { Sucursal } from '../sucursales/sucursal.entity';
import { MetodoPago } from './enums/metodo-pago.enum';
import { TarjetaTipo } from './enums/tarjeta-tipo.enum';
import { TipoMovimiento } from './enums/tipo-movimiento.enum';
import { CajaMovimientoDetalle } from './entities/caja-movimiento-detalle.entity';

@Injectable()
export class CajaService {
  constructor(
    @InjectRepository(CajaApertura)
    private readonly aperturaRepo: Repository<CajaApertura>,

    @InjectRepository(CajaMovimiento)
    private readonly movRepo: Repository<CajaMovimiento>,

    @InjectRepository(CajaCierre)
    private readonly cierreRepo: Repository<CajaCierre>,

    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,

    private readonly ds: DataSource,
  ) {}

  // -------------------------
  // Helpers
  // -------------------------
  private toNumber2(n: any): number {
    const x = Number(n);
    if (!Number.isFinite(x)) return NaN;
    return Math.round(x * 100) / 100;
  }
  
  private normalizarPagos(dto: MovimientoDto) {
    // Si viene nuevo
    if (dto.pagos && dto.pagos.length) {
      return dto.pagos.map((p) => ({
        metodoPago: p.metodoPago,
        monto: this.toNumber2(p.monto),
        tarjetaTipo: p.tarjetaTipo,
        tarjetaUltimos4: p.tarjetaUltimos4,
        codigoAutorizacion: p.codigoAutorizacion,
        nombreEntidad: p.nombreEntidad,
      }));
    }

    // Compat viejo -> lo convertimos a pagos[0]
    if (!dto.metodoPago || dto.monto == null) {
      throw new BadRequestException(
        'Debe venir pagos[] o (metodoPago + monto)',
      );
    }

    return [
      {
        metodoPago: dto.metodoPago,
        monto: this.toNumber2(dto.monto),
        tarjetaTipo: dto.tarjetaTipo,
        tarjetaUltimos4: dto.tarjetaUltimos4,
        codigoAutorizacion: dto.codigoAutorizacion,
        nombreEntidad: dto.nombreEntidad,
      },
    ];
  }

  private validarPagos(pagos: Array<any>) {
    if (!pagos.length) throw new BadRequestException('pagos requerido');

    let sum = 0;

    for (const p of pagos) {
      if (!p.metodoPago) throw new BadRequestException('metodoPago requerido');
      if (!(p.monto > 0)) throw new BadRequestException('monto debe ser > 0');

      sum += p.monto;

      // Reglas por método
      if (p.metodoPago === MetodoPago.TARJETA) {
        if (!p.tarjetaTipo) {
          throw new BadRequestException('tarjetaTipo requerido para TARJETA');
        }
        // opcional: últimos 4 si querés forzarlo:
        // if (!p.tarjetaUltimos4) throw new BadRequestException('tarjetaUltimos4 requerido para TARJETA');
      }

      if (
        p.metodoPago === MetodoPago.TRANSFERENCIA ||
        p.metodoPago === MetodoPago.BILLETERA ||
        p.metodoPago === MetodoPago.CHEQUE
      ) {
        // suele ser útil exigir entidad (Banco / MercadoPago / etc.)
        if (!p.nombreEntidad || !String(p.nombreEntidad).trim()) {
          throw new BadRequestException(
            `nombreEntidad requerido para ${p.metodoPago}`,
          );
        }
      }
    }

    sum = this.toNumber2(sum);
    if (!(sum > 0)) throw new BadRequestException('Suma de pagos inválida');

    return { total: sum };
  }

  // 👉 APERTURA DE CAJA
  async abrir(dto: AperturaDto) {
    const abierta = await this.aperturaRepo.findOne({
      where: { abierta: true },
    });
    if (abierta) throw new BadRequestException('Ya existe una caja abierta');

    const sucursal = await this.sucursalRepo.findOne({
      where: { id: dto.sucursalId },
    });
    if (!sucursal) throw new BadRequestException('Sucursal no encontrada');

    const apertura = this.aperturaRepo.create({
      fechaApertura: new Date(),
      saldoInicial: dto.saldoInicial,
      usuarioApertura: dto.usuario,
      abierta: true,
      sucursalId: sucursal.id, // ✅ clave
      sucursal,
    });

    return await this.aperturaRepo.save(apertura);
  }

  // -------------------------
  // Movimiento (split payments)
  // -------------------------
  async movimiento(dto: MovimientoDto) {
    return this.ds.transaction(async (manager) => {
      const apertura = await manager.getRepository(CajaApertura).findOne({
        where: { abierta: true },
      });
      if (!apertura) throw new BadRequestException('No hay caja abierta');

      const pagos = this.normalizarPagos(dto);
      const { total } = this.validarPagos(pagos);

      // Cabecera
      const mov = manager.getRepository(CajaMovimiento).create({
        aperturaId: apertura.id,
        apertura,
        fecha: new Date(),
        tipo: dto.tipo,

        // ✅ consistencia con tu entity (string | null)
        referencia: dto.referencia ?? null,

        usuario: dto.usuario,
        montoTotal: total,

        // ✅ compat viejo: guardo resumen (opcional)
        monto: total,
        metodoPago: pagos.length === 1 ? pagos[0].metodoPago : null,
        tarjetaTipo: pagos.length === 1 ? (pagos[0].tarjetaTipo ?? null) : null,
        tarjetaUltimos4:
          pagos.length === 1 ? (pagos[0].tarjetaUltimos4 ?? null) : null,
        codigoAutorizacion:
          pagos.length === 1 ? (pagos[0].codigoAutorizacion ?? null) : null,
        nombreEntidad:
          pagos.length === 1 ? (pagos[0].nombreEntidad ?? null) : null,
      });


      const savedMov = await manager.getRepository(CajaMovimiento).save(mov);

      // Detalles
      const detRepo = manager.getRepository(CajaMovimientoDetalle);

      const detalles = pagos.map((p) =>
        detRepo.create({
          movimiento: savedMov, // ✅ suficiente
          metodoPago: p.metodoPago,
          monto: p.monto,
          tarjetaTipo: p.tarjetaTipo ?? undefined,
          tarjetaUltimos4: p.tarjetaUltimos4 ?? undefined,
          codigoAutorizacion: p.codigoAutorizacion ?? undefined,
          nombreEntidad: p.nombreEntidad ?? undefined,
        }),
      );

      await detRepo.save(detalles);


      // devolvemos con detalles (útil para UI)
      return {
        ...savedMov,
        detalles,
      };
    });
  }

  // -------------------------
  // Cierre: totales por detalle
  // -------------------------
  async cerrar(dto: CerrarCajaDto) {
    return this.ds.transaction(async (manager) => {
      const apertura = await manager.getRepository(CajaApertura).findOne({
        where: { abierta: true },
      });
      if (!apertura) throw new BadRequestException('No hay caja abierta');

      // Totales por método (SQL eficiente)
      const rows = await manager.query(
        `
        SELECT
          d.metodo_pago AS metodo,
          COALESCE(SUM(
            d.monto *
            CASE WHEN m.tipo = 'INGRESO' THEN 1 ELSE -1 END
          ),0)::numeric(12,2) AS total
        FROM caja_movimiento m
        JOIN caja_movimiento_detalle d ON d.movimiento_id = m.id
        WHERE m.apertura_id = $1
        GROUP BY d.metodo_pago
        `,
        [apertura.id],
      );

      const totales: Record<string, number> = {
        EFECTIVO: 0,
        TARJETA: 0,
        TRANSFERENCIA: 0,
        BILLETERA: 0,
        CHEQUE: 0,
        CTA_CORRIENTE: 0,
      };

      for (const r of rows) {
        const metodo = String(r.metodo);
        if (totales[metodo] !== undefined) {
          totales[metodo] = Number(r.total);
        }
      }

      const saldoInicial = Number(apertura.saldoInicial);

      const totalCalculado =
        saldoInicial +
        Object.values(totales).reduce((a, b) => Number(a) + Number(b), 0);

      const diferencia = Number(dto.totalRealEfectivo) - Number(totalCalculado);

      const cierre = manager.getRepository(CajaCierre).create({
        apertura,
        fechaCierre: new Date(),
        totalEfectivo: totales.EFECTIVO,
        totalTarjetas: totales.TARJETA,
        totalTransferencias: totales.TRANSFERENCIA,
        totalBilleteras: totales.BILLETERA,
        totalCheques: totales.CHEQUE,
        totalCuentaCorriente: totales.CTA_CORRIENTE,
        totalTeorico: Number(totalCalculado.toFixed(2)),
        totalRealEfectivo: Number(dto.totalRealEfectivo),
        diferencia: Number(diferencia.toFixed(2)),
        observaciones: dto.observaciones,
        usuarioCierre: dto.usuario,
      });

      await manager.getRepository(CajaCierre).save(cierre);

      // cerrar caja
      apertura.abierta = false;
      await manager.getRepository(CajaApertura).save(apertura);

      return cierre;
    });
  }

  // -------------------------
  // Estado sucursal: totales por detalle + saldo teórico
  // -------------------------
  async estadoSucursal(sucursalId: string) {
    const apertura = await this.aperturaRepo.findOne({
      where: { sucursalId, abierta: true },
    });

    if (!apertura) {
      return {
        sucursalId,
        cajaAbierta: false,
        mensaje: 'La sucursal no tiene caja abierta actualmente',
      };
    }

    const rows = await this.aperturaRepo.manager.query(
      `
      SELECT
        d.metodo_pago AS metodo,
        COALESCE(SUM(
          d.monto *
          CASE WHEN m.tipo = 'INGRESO' THEN 1 ELSE -1 END
        ),0)::numeric(12,2) AS total,
        COUNT(DISTINCT m.id)::int AS movimientos
      FROM caja_movimiento m
      JOIN caja_movimiento_detalle d ON d.movimiento_id = m.id
      WHERE m.apertura_id = $1
      GROUP BY d.metodo_pago
      `,
      [apertura.id],
    );

    const totales: Record<string, number> = {
      EFECTIVO: 0,
      TARJETA: 0,
      TRANSFERENCIA: 0,
      BILLETERA: 0,
      CHEQUE: 0,
      CTA_CORRIENTE: 0,
    };

    let cantMovs = 0;
    for (const r of rows) {
      const metodo = String(r.metodo);
      if (totales[metodo] !== undefined) totales[metodo] = Number(r.total);
      cantMovs = Math.max(cantMovs, Number(r.movimientos ?? 0));
    }

    const saldoInicial = Number(apertura.saldoInicial);
    const saldoTeorico =
      saldoInicial +
      Object.values(totales).reduce((a, b) => Number(a) + Number(b), 0);

    return {
      sucursalId,
      cajaAbierta: true,
      apertura: {
        id: apertura.id,
        fechaApertura: apertura.fechaApertura,
        usuarioApertura: apertura.usuarioApertura,
        saldoInicial,
      },
      totalesPorMetodo: totales,
      saldoTeorico: Number(saldoTeorico.toFixed(2)),
      cantidadMovimientos: cantMovs,
    };
  }

  /*------------------------------------------------------------*/
  getMetodosPago() {
    return Object.values(MetodoPago).map((v) => ({
      label: v,
      value: v,
    }));
  }

  getTiposTarjeta() {
    return Object.values(TarjetaTipo).map((v) => ({
      label: v,
      value: v,
    }));
  }

  getTiposMovimiento() {
    return Object.values(TipoMovimiento).map((v) => ({
      label: v,
      value: v,
    }));
  }

  async getConfiguracionCaja() {
    const sucursales = await this.sucursalRepo.find({
      select: ['id', 'nombre'],
    });

    return {
      metodosPago: this.getMetodosPago(),
      tiposTarjeta: this.getTiposTarjeta(),
      tiposMovimiento: this.getTiposMovimiento(),
      sucursales: sucursales.map((s) => ({
        label: s.nombre,
        value: s.id,
      })),
    };
  }
}

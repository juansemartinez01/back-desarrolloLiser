// src/caja/caja.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

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

  // 👉 REGISTRAR MOVIMIENTO
  async movimiento(dto: MovimientoDto) {
    const apertura = await this.aperturaRepo.findOne({
      where: { abierta: true },
    });
    if (!apertura) throw new BadRequestException('No hay caja abierta');

    const mov = this.movRepo.create({
      apertura,
      fecha: new Date(),
      ...dto,
    });

    return await this.movRepo.save(mov);
  }

  // 👉 CIERRE DE CAJA
  async cerrar(dto: CerrarCajaDto) {
    const apertura = await this.aperturaRepo.findOne({
      where: { abierta: true },
      relations: ['movimientos'],
    });

    if (!apertura) throw new BadRequestException('No hay caja abierta');

    // Calcular total teórico
    let total = Number(apertura.saldoInicial);

    for (const mov of apertura.movimientos) {
      const monto = Number(mov.monto);
      if (mov.tipo === 'INGRESO') total += monto;
      else total -= monto;
    }

    const diferencia = dto.totalRealEfectivo - total;

    const totales: Record<string, number> = {
      EFECTIVO: 0,
      TARJETA: 0,
      TRANSFERENCIA: 0,
      BILLETERA: 0,
      CHEQUE: 0,
      CTA_CORRIENTE: 0,
    };

    for (const mov of apertura.movimientos) {
      const monto = Number(mov.monto);

      const signo = mov.tipo === 'INGRESO' ? 1 : -1;

      totales[mov.metodoPago] += monto * signo;
    }

    const totalCalculado = Object.values(totales).reduce(
      (a, b) => (a as number) + (b as number),
      apertura.saldoInicial,
    );

    const cierre = this.cierreRepo.create({
      apertura,
      fechaCierre: new Date(),
      totalEfectivo: totales.EFECTIVO,
      totalTarjetas: totales.TARJETA,
      totalTransferencias: totales.TRANSFERENCIA,
      totalBilleteras: totales.BILLETERA,
      totalCheques: totales.CHEQUE,
      totalCuentaCorriente: totales.CTA_CORRIENTE,
      totalTeorico: totalCalculado,
      totalRealEfectivo: dto.totalRealEfectivo,
      diferencia: dto.totalRealEfectivo - totalCalculado,
      observaciones: dto.observaciones,
      usuarioCierre: dto.usuario,
    });

    await this.cierreRepo.save(cierre);

    // cerrar caja
    apertura.abierta = false;
    await this.aperturaRepo.save(apertura);

    return cierre;
  }

  // src/caja/caja.service.ts

  async estadoSucursal(sucursalId: string) {
    // 1) Buscar apertura activa de esa sucursal
    const apertura = await this.aperturaRepo.findOne({
      where: {
        sucursalId: sucursalId,
        abierta: true,
      },
      relations: ['movimientos'], // Necesitamos los movimientos para calcular totales
    });

    // Si NO hay caja abierta
    if (!apertura) {
      return {
        sucursalId,
        cajaAbierta: false,
        mensaje: 'La sucursal no tiene caja abierta actualmente',
      };
    }

    // 2) Iniciar totales por método de pago
    const totales: Record<string, number> = {
      EFECTIVO: 0,
      TARJETA: 0,
      TRANSFERENCIA: 0,
      BILLETERA: 0,
      CHEQUE: 0,
      CTA_CORRIENTE: 0,
    };

    // 3) Calcular totales por método y saldo teórico
    let saldoTeorico = Number(apertura.saldoInicial);

    for (const m of apertura.movimientos) {
      const monto = Number(m.monto);
      const signo = m.tipo === 'INGRESO' ? 1 : -1;

      // Sumar al método de pago
      if (totales[m.metodoPago] !== undefined) {
        totales[m.metodoPago] += monto * signo;
      }

      // Sumar al saldo teórico general
      saldoTeorico += monto * signo;
    }

    // 4) Respuesta armada
    return {
      sucursalId,
      cajaAbierta: true,
      apertura: {
        id: apertura.id,
        fechaApertura: apertura.fechaApertura,
        usuarioApertura: apertura.usuarioApertura,
        saldoInicial: Number(apertura.saldoInicial),
      },
      totalesPorMetodo: totales,
      saldoTeorico: Number(saldoTeorico.toFixed(2)),
      cantidadMovimientos: apertura.movimientos.length,
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

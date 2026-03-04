// src/caja/caja.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CajaService } from './caja.service';
import { AperturaDto } from './dto/apertura.dto';
import { MovimientoDto } from './dto/movimiento.dto';
import { CerrarCajaDto } from './dto/cierre.dto';
import { QueryPanelCajaDto } from './dto/query-panel-caja.dto';

@Controller('caja')
export class CajaController {
  constructor(private readonly service: CajaService) {}

  @Post('abrir')
  abrir(@Body() dto: AperturaDto) {
    return this.service.abrir(dto);
  }

  @Post('movimiento')
  movimiento(@Body() dto: MovimientoDto) {
    return this.service.movimiento(dto);
  }

  @Post('cerrar')
  cerrar(@Body() dto: CerrarCajaDto) {
    return this.service.cerrar(dto);
  }

  @Get('sucursal/:id/estado')
  estado(@Param('id') id: string) {
    return this.service.estadoSucursal(id);
  }

  // ✅ Panel / Reporte de movimientos con filtros
  @Get('panel/movimientos')
  panelMovimientos(@Query() q: QueryPanelCajaDto) {
    return this.service.panelMovimientos(q);
  }

  @Get('metodos-pago')
  getMetodosPago() {
    return this.service.getMetodosPago();
  }

  @Get('tipos-tarjeta')
  getTiposTarjeta() {
    return this.service.getTiposTarjeta();
  }

  @Get('tipos-movimiento')
  getTiposMovimiento() {
    return this.service.getTiposMovimiento();
  }

  @Get('configuracion')
  async getConfiguracion() {
    return this.service.getConfiguracionCaja();
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AjusteCambioService } from './ajuste-cambio.service';
import { AjusteCambioDto } from './dto/ajuste-cambio.dto';
import { AjusteCambioFiltrosDto } from './dto/ajuste-cambio-filtros.dto';

@Controller('stock/movimientos')
export class AjusteCambioController {
  constructor(private readonly service: AjusteCambioService) {}

  @Post('ajuste-cambio')
  async ajustar(@Body() dto: AjusteCambioDto) {
    return this.service.registrarAjusteCambio(dto);
  }

  @Get('ajuste-cambio')
  async listar(@Query() filtros: AjusteCambioFiltrosDto) {
    return this.service.listarAjustesCambio(filtros);
  }
}

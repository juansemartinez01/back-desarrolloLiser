import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { TransferenciasPendientesService } from './transferencias-pendientes.service';
import { RecibirTransferenciaDto } from './dto/recibir-transferencia.dto';

@Controller('stock/transferencias-pendientes')
export class TransferenciasPendientesController {
  constructor(private readonly service: TransferenciasPendientesService) {}

  @Get()
  async pendientes(@Query('almacen_id') almacen_id?: number) {
    return this.service.pendientes(almacen_id ? Number(almacen_id) : undefined);
  }

  @Post('recibir')
  async recibir(@Body() dto: RecibirTransferenciaDto) {
    return this.service.recibir(dto);
  }
}

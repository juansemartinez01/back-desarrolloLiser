import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { ReservarStockDto } from './dto/reservar-stock.dto';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';
import { ConfirmarReservaDto } from './dto/confirmar-reserva.dto';
import { QueryReservasDetalleDto } from './dto/query-reservas-detalle.dto';

@Controller('reservas')
export class ReservasController {
  constructor(private readonly service: ReservasService) {}

  @Post()
  reservar(@Body() dto: ReservarStockDto) {
    return this.service.reservar(dto);
  }

  @Post('cancelar')
  cancelar(@Body() dto: CancelarReservaDto) {
    return this.service.cancelar(dto);
  }

  @Post('confirmar')
  confirmar(@Body() dto: ConfirmarReservaDto) {
    return this.service.confirmar(dto);
  }

  @Get('stock-por-almacen')
  stockPorAlmacen(@Query('almacen_id', ParseIntPipe) almacen_id: number) {
    return this.service.stockPorAlmacen(almacen_id);
  }

  @Get('pendientes/:pedido_id')
  listarPorPedido(@Param('pedido_id') pedido_id: number) {
    return this.service.listarPorPedido(pedido_id);
  }

  @Get('disponible')
  stockDisponible(
    @Query('producto_id') producto_id: number,
    @Query('almacen_id') almacen_id: number,
  ) {
    return this.service.stockDisponible(producto_id, almacen_id);
  }

  @Get()
  listar() {
    return this.service.listar();
  }

  // NUEVO: listado de reservas con detalle de producto
  @Get('con-detalle/agrupadas')
  listarConDetalleAgrupado(@Query() q: QueryReservasDetalleDto) {
    return this.service.listarConDetalleAgrupado(q);
  }
}

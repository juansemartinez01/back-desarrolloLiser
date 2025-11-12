import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { MovimientosConsultasService } from './movimientos-consultas.service';
import { QueryMovimientosDto } from './dto/query-movimientos.dto';
import { QueryVentasProductoDto } from './dto/query-ventas-producto.dto';
import { QueryIngresosProductoDto } from './dto/query-ingresos-producto.dto';
import { QueryEgresosProductoDto } from './dto/query-egresos-producto.dto';

@Controller('stock/movimientos')
export class MovimientosConsultasController {
  constructor(private readonly service: MovimientosConsultasService) {}

  @Get('ventas-por-producto')
  async ventasPorProducto(@Query() q: QueryVentasProductoDto) {
    return this.service.getVentasPorProducto(q);
  }

  @Get('ingresos-por-producto')
  async ingresosPorProducto(@Query() q: QueryIngresosProductoDto) {
    return this.service.ingresosPorProducto(q);
  }

  @Get('egresos-por-producto')
  async egresosPorProducto(@Query() q: QueryEgresosProductoDto) {
    return this.service.egresosPorProducto(q);
  }

  // GET /stock/movimientos?tipo=...&producto_id=...&page=1&limit=50&...
  @Get()
  async listar(@Query() q: QueryMovimientosDto) {
    return this.service.listar(q);
  }

  // GET /stock/movimientos/:id
  @Get(':id')
  async detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalle(id);
  }
}

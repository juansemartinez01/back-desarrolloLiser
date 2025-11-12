import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { MovimientosConsultasService } from './movimientos-consultas.service';
import { QueryMovimientosDto } from './dto/query-movimientos.dto';

@Controller('stock/movimientos')
export class MovimientosConsultasController {
  constructor(private readonly service: MovimientosConsultasService) {}

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

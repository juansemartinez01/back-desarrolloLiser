import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PagosService } from './pagos.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { QueryPagosDto } from './dto/query-pagos.dto';

@Controller('cc/pagos')
export class PagosController {
  constructor(private readonly service: PagosService) {}

  // Crea pago y aplica FIFO a cargos abiertos
  @Post()
  async crear(@Body() dto: CreatePagoDto) {
    return this.service.crearPagoYAplicar(dto);
  }

  // Listado con aplicado/sin_aplicar
  @Get()
  async listar(@Query() q: QueryPagosDto) {
    return this.service.listarPagos(q);
  }

  // Detalle con aplicaciones
  @Get(':id')
  async detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detallePago(id);
  }
}

// src/modules/backoffice/cc/pagos/bo-pagos.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { BoPagosService } from './bo-pagos.service';
import { BoCreatePagoDto } from './dto/bo-create-pago.dto';
import { BoQueryPagosDto } from './dto/bo-query-pagos.dto';

@Controller('backoffice/cc/pagos')
export class BoPagosController {
  constructor(private readonly service: BoPagosService) {}

  @Post()
  crear(@Body() dto: BoCreatePagoDto) {
    return this.service.crearPagoYAplicar(dto);
  }

  @Get()
  listar(@Query() q: BoQueryPagosDto) {
    return this.service.listarPagos(q);
  }

  @Get(':id')
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detallePago(id);
  }
}

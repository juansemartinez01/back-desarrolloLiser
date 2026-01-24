import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { CreateFacturaDto } from './dto/create-factura.dto';
import { QueryFacturasDto } from './dto/query-facturas.dto';
import { ConsultarCondicionIvaDto } from '../emisores/dto/consultar-condicion-iva.dto';

@Controller('facturacion/facturas')
export class FacturasController {
  constructor(private readonly service: FacturasService) {}

  @Post()
  crearYEmitir(@Body() dto: CreateFacturaDto) {
    return this.service.crearYEmitir(dto);
  }

  @Get()
  listar(@Query() q: QueryFacturasDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalle(id);
  }

  @Post('consultar-condicion-iva')
  consultarCondicionIva(@Body() dto: ConsultarCondicionIvaDto) {
    return this.service.consultarCondicionIva(dto);
  }
}

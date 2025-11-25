import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ComprasService } from './compras.service';
import { CreateCompraDto } from './dto/create-compra.dto';
import { QueryComprasDto } from './dto/query-compras.dto';

@Controller('facturacion/compras')
export class ComprasController {
  constructor(private readonly service: ComprasService) {}

  @Post()
  crear(@Body() dto: CreateCompraDto) {
    return this.service.crearCompra(dto);
  }

  @Get()
  listar(@Query() q: QueryComprasDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalle(id);
  }
}

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
import { AplicarPagoDto, CrearPagoDto, QueryPagosDto } from './dto/pagos.dto';

@Controller('fin/pagos')
export class PagosController {
  constructor(private readonly service: PagosService) {}

  @Post()
  crear(@Body() dto: CrearPagoDto) {
    return this.service.crear(dto);
  }

  @Post(':id/aplicar')
  aplicar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AplicarPagoDto,
  ) {
    return this.service.aplicar(id, dto);
  }

  @Post(':id/anular')
  anular(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.anular(id);
  }

  @Get()
  listar(@Query() q: QueryPagosDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalle(id);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { LiquidacionesService } from './liquidaciones.service';
import { CreateLiquidacionDto } from './dto/create-liquidacion.dto';
import { QueryLiquidacionesDto } from './dto/query-liquidaciones.dto';

@Controller('facturacion/liquidaciones')
export class LiquidacionesController {
  constructor(private readonly service: LiquidacionesService) {}

  @Post()
  crearYEmitir(@Body() dto: CreateLiquidacionDto) {
    return this.service.crearYEmitir(dto);
  }

  @Get()
  listar(@Query() q: QueryLiquidacionesDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalle(id);
  }
}

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
import { CrearLiquidacionDto } from './dto/create-liquidacion.dto';
import { ConfirmarLiquidacionDto } from './dto/confirmar-liquidacion.dto';
import { QueryLiquidacionesDto } from './dto/query-liquidaciones.dto';

@Controller('fin/liquidaciones')
export class LiquidacionesController {
  constructor(private readonly service: LiquidacionesService) {}

  // Preview: qué ítems/quantidades están liquidables (vendido - ya liquidado)
  @Get('preview')
  async preview(@Query('proveedor_id') proveedor_id: string) {
    const pid = Number(proveedor_id);
    return this.service.previewLiquidables(pid);
  }

  // Crear BORRADOR
  @Post()
  async crear(@Body() dto: CrearLiquidacionDto) {
    return this.service.crear(dto);
  }

  // Confirmar
  @Post(':id/confirmar')
  async confirmar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ConfirmarLiquidacionDto,
  ) {
    return this.service.confirmar(id, dto);
  }

  // Listado
  @Get()
  async listar(@Query() q: QueryLiquidacionesDto) {
    return this.service.listar(q);
  }

  // Detalle
  @Get(':id')
  async detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalle(id);
  }
}

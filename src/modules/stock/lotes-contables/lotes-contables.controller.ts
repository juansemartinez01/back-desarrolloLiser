// src/modules/stock/lotes-contables/lotes-contables.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Delete,
  Query,
} from '@nestjs/common';
import { LotesContablesService } from './lotes-contables.service';
import {
  CreateLoteContableDto,
  UpdateLoteContableDto,
  QueryLoteContableDto,
} from './dto/lote-contable.dto';
import { QueryTipo1Dto } from './dto/query-tipo1.dto';
import { SeleccionarTipo1Dto } from './dto/seleccionar-tipo1.dto';

@Controller('stock/lotes-contables')
export class LotesContablesController {
  constructor(private readonly service: LotesContablesService) {}

  // GET /stock/lotes-contables?lote_id=&estado=&page=&limit=
  @Get()
  async listar(@Query() q: QueryLoteContableDto) {
    return this.service.listar(q);
  }

  @Get('tipo1')
  async productosTipo1(@Query() q: QueryTipo1Dto) {
    return this.service.productosConTipo1Extendido(q);
  }

  // GET /stock/lotes-contables/:id
  @Get(':id')
  async obtener(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obtener(id);
  }

  @Post('tipo1/seleccionar')
  async seleccionarTipo1(@Body() dto: SeleccionarTipo1Dto) {
    return this.service.seleccionarProductosTipo1(dto);
  }

  // POST /stock/lotes-contables
  @Post()
  async crear(@Body() dto: CreateLoteContableDto) {
    return this.service.crear(dto);
  }

  @Post('facturar')
  async facturar(@Body() dto: { producto_id: number; cantidad: number }) {
    return this.service.registrarFacturacion(dto.producto_id, dto.cantidad);
  }

  // PATCH /stock/lotes-contables/:id
  @Patch(':id')
  async actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLoteContableDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  // DELETE /stock/lotes-contables/:id  (opcional)
  @Delete(':id')
  async borrar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.borrar(id);
  }
}

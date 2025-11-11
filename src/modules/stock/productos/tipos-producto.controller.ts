// src/modules/stock/productos/tipos-producto.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Delete,
  Query,
} from '@nestjs/common';
import { TiposProductoService } from './tipos-producto.service';
import {
  CreateTipoProductoDto,
  UpdateTipoProductoDto,
  QueryTipoProductoDto,
} from './dto/tipo-producto.dto';

@Controller('stock/tipos-producto')
export class TiposProductoController {
  constructor(private readonly service: TiposProductoService) {}

  @Get()
  listar(@Query() q: QueryTipoProductoDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtener(id);
  }

  @Post()
  crear(@Body() dto: CreateTipoProductoDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTipoProductoDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  borrar(@Param('id', ParseIntPipe) id: number) {
    return this.service.borrar(id);
  }
}

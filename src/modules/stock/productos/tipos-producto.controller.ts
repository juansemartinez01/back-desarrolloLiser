// tipos-producto.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { TiposProductoService } from './tipos-producto.service';
import {
  CreateTipoProductoDto,
  QueryTipoProductoDto,
  UpdateTipoProductoDto,
} from './dto/tipo-producto.dto';

@Controller('stock/tipos-producto')
export class TiposProductoController {
  constructor(private readonly service: TiposProductoService) {}

  @Get()
  async listar(@Query() q: QueryTipoProductoDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  async obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtener(id);
  }

  @Post()
  async crear(@Body() dto: CreateTipoProductoDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTipoProductoDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  async borrar(@Param('id', ParseIntPipe) id: number) {
    return this.service.borrar(id);
  }
}

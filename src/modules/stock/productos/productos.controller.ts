// src/modules/stock/productos/productos.controller.ts
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
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { QueryProductosDto } from './dto/query-productos.dto';

@Controller('stock/productos')
export class ProductosController {
  constructor(private readonly service: ProductosService) {}

  @Post()
  async crear(@Body() dto: CreateProductoDto) {
    return this.service.create(dto);
  }

  @Get()
  async listar(@Query() q: QueryProductosDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  async detalle(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductoDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async baja(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

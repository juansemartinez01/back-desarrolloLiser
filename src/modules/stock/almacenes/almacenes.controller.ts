// src/modules/stock/almacenes/almacenes.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Delete,
} from '@nestjs/common';
import { AlmacenesService } from './almacenes.service';
import {
  CreateAlmacenDto,
  QueryAlmacenDto,
  UpdateAlmacenDto,
} from './dto/almacen.dto';

@Controller('stock/almacenes')
export class AlmacenesController {
  constructor(private readonly service: AlmacenesService) {}

  @Get()
  async listar(@Query() q: QueryAlmacenDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  async obtener(@Param('id') id: string) {
    return this.service.obtener(id);
  }

  @Post()
  async crear(@Body() dto: CreateAlmacenDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  @Patch(':id')
  async actualizar(
    @Param('id') id: string,
    @Body() dto: UpdateAlmacenDto,
  ) {
    return this.service.actualizar(id, dto);
  }
  
}

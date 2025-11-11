// src/modules/stock/productos/unidades.controller.ts
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
import { UnidadesService } from './unidades.service';
import {
  CreateUnidadDto,
  UpdateUnidadDto,
  QueryUnidadDto,
} from './dto/unidad.dto';

@Controller('stock/unidades')
export class UnidadesController {
  constructor(private readonly service: UnidadesService) {}

  @Get()
  listar(@Query() q: QueryUnidadDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtener(id);
  }

  @Post()
  crear(@Body() dto: CreateUnidadDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUnidadDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  borrar(@Param('id', ParseIntPipe) id: number) {
    return this.service.borrar(id);
  }
}

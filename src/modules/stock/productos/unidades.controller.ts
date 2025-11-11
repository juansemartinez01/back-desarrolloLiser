// unidades.controller.ts
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
import { UnidadesService } from './unidades.service';
import {
  CreateUnidadDto,
  QueryUnidadDto,
  UpdateUnidadDto,
} from './dto/unidad.dto';

@Controller('stock/unidades')
export class UnidadesController {
  constructor(private readonly service: UnidadesService) {}

  @Get()
  async listar(@Query() q: QueryUnidadDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  async obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtener(id);
  }

  @Post()
  async crear(@Body() dto: CreateUnidadDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUnidadDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  async borrar(@Param('id', ParseIntPipe) id: number) {
    return this.service.borrar(id);
  }
}

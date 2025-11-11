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

@Controller('stock/lotes-contables')
export class LotesContablesController {
  constructor(private readonly service: LotesContablesService) {}

  // GET /stock/lotes-contables?lote_id=&estado=&page=&limit=
  @Get()
  async listar(@Query() q: QueryLoteContableDto) {
    return this.service.listar(q);
  }

  // GET /stock/lotes-contables/:id
  @Get(':id')
  async obtener(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obtener(id);
  }

  // POST /stock/lotes-contables
  @Post()
  async crear(@Body() dto: CreateLoteContableDto) {
    return this.service.crear(dto);
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

// src/modules/backoffice/cc/ajustes/bo-ajustes.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { BoAjustesService } from './bo-ajustes.service';
import { BoCreateAjusteDto } from './dto/bo-create-ajuste.dto';
import { BoQueryAjustesDto } from './dto/bo-query-ajustes.dto';

@Controller('backoffice/cc/ajustes')
export class BoAjustesController {
  constructor(private readonly service: BoAjustesService) {}

  @Post()
  crear(@Body() dto: BoCreateAjusteDto) {
    return this.service.crearAjuste(dto);
  }

  @Get()
  listar(@Query() q: BoQueryAjustesDto) {
    return this.service.listarAjustes(q);
  }

  @Get(':id')
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalleAjuste(id);
  }
}

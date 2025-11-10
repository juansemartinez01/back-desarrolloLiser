import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AjustesService } from './ajustes.service';
import { CreateAjusteDto } from './dto/create-ajuste.dto';
import { QueryAjustesDto } from './dto/query-ajustes.dto';

@Controller('cc/ajustes')
export class AjustesController {
  constructor(private readonly service: AjustesService) {}

  @Post()
  async crear(@Body() dto: CreateAjusteDto) {
    return this.service.crearAjuste(dto);
  }

  @Get()
  async listar(@Query() q: QueryAjustesDto) {
    return this.service.listarAjustes(q);
  }

  @Get(':id')
  async detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalleAjuste(id);
  }
}

// src/modules/backoffice/cc/cargos/bo-cargos.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { BoCargosService } from './bo-cargos.service';
import {
  BoCreateCargoDto,
  BoCreateCargosBulkDto,
} from './dto/bo-create-cargo.dto';
import { BoQueryCargosDto } from './dto/bo-query-cargos.dto';

@Controller('backoffice/cc/cargos')
export class BoCargosController {
  constructor(private readonly service: BoCargosService) {}

  @Post()
  crear(@Body() dto: BoCreateCargoDto) {
    return this.service.crearCargo(dto);
  }

  @Post('bulk')
  crearBulk(@Body() dto: BoCreateCargosBulkDto) {
    return this.service.crearCargosBulk(dto.items ?? []);
  }

  @Get()
  listar(@Query() q: BoQueryCargosDto) {
    return this.service.listarCargos(q);
  }

  @Get(':id')
  obtener(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obtenerCargo(id);
  }
}

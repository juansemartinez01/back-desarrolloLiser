import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CargosService } from './cargos.service';
import { CreateCargoDto, CreateCargosBulkDto } from './dto/create-cargo.dto';
import { QueryCargosDto } from './dto/query-cargos.dto';

@Controller('cc/cargos')
export class CargosController {
  constructor(private readonly service: CargosService) {}

  @Post()
  async crear(@Body() dto: CreateCargoDto) {
    return this.service.crearCargo(dto);
  }

  @Post('bulk')
  async crearBulk(@Body() dto: CreateCargosBulkDto) {
    return this.service.crearCargosBulk(dto.items ?? []);
  }

  @Get()
  async listar(@Query() q: QueryCargosDto) {
    return this.service.listarCargos(q);
  }

  @Get(':id')
  async obtener(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obtenerCargo(id);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { EmisoresService } from './emisores.service';
import { CreateEmisorDto } from './dto/create-emisor.dto';
import { UpdateEmisorDto } from './dto/update-emisor.dto';
import { QueryEmisoresDto } from './dto/query-emisores.dto';
import { RegistrarEmisorDto } from './dto/registrar-emisor.dto';

@Controller('facturacion/emisores')
export class EmisoresController {
  constructor(private readonly service: EmisoresService) {}

  // Crear (fail si existe combinación única)
  @Post()
  crear(@Body() dto: CreateEmisorDto) {
    return this.service.crear(dto);
  }

  // Actualizar por id (parcial)
  @Put(':id')
  actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmisorDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  // Listado
  @Get()
  listar(@Query() q: QueryEmisoresDto) {
    return this.service.listar(q);
  }

  // Detalle
  @Get(':id')
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalle(id);
  }

  // Activar / Desactivar
  @Patch(':id/activar')
  activar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.setActivo(id, true);
  }

  @Patch(':id/desactivar')
  desactivar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.setActivo(id, false);
  }

  // Registrar certificados en el servicio externo (subir /certificados)
  @Post(':id/registrar')
  registrar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RegistrarEmisorDto,
  ) {
    return this.service.registrarEnExterno(id, dto?.test);
  }
}

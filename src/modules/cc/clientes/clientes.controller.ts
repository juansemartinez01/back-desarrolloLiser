import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';

@Controller('cc/clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  // Listado
  @Get()
  async listar(@Query() q: QueryClientesDto) {
    return this.service.listar(q);
  }

  // Obtener detalle
  @Get(':id')
  async obtener(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obtener(id);
  }

  // Crear
  @Post()
  async crear(@Body() dto: CreateClienteDto) {
    return this.service.crear(dto);
  }

  // Actualizar
  @Patch(':id')
  async actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateClienteDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  // Desactivar / Activar (baja lógica)
  @Patch(':id/desactivar')
  async desactivar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.desactivar(id);
  }

  @Patch(':id/activar')
  async activar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.activar(id);
  }

  // Eliminar (hard delete)
  @Delete(':id')
  async eliminar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.eliminar(id);
  }
}

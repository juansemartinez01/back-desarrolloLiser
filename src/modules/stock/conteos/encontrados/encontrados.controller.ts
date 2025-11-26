import { Body, Controller, Post } from '@nestjs/common';
import { EncontradosService } from './encontrados.service';
import { EncontradoDto } from './dto/encontrado.dto';

@Controller('stock/encontrados')
export class EncontradosController {
  constructor(private readonly service: EncontradosService) {}

  @Post()
  async registrar(@Body() dto: EncontradoDto) {
    return this.service.registrarEncontrado(dto);
  }
}

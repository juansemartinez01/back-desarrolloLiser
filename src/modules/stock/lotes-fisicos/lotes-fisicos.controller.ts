import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { LotesFisicosService } from './lotes-fisicos.service';
import { QueryLotesFisicosDto } from './dto/query-lotes-fisicos.dto';

@Controller('stock/lotes-fisicos')
export class LotesFisicosController {
  constructor(private readonly service: LotesFisicosService) {}

  @Get('fisicos/sin-contable')
  async listarFisicosSinContable() {
    return this.service.listarFisicosSinContable();
  }
  
  @Get()
  async listar(@Query() q: QueryLotesFisicosDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  async detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalle(id);
  }
}

import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { BackofficeLotesFisicosService } from './backoffice-lotes-fisicos.service';
import { QueryBackofficeLotesFisicosDto } from './dto/query-backoffice-lotes-fisicos.dto';

@Controller('backoffice/lotes')
export class BackofficeLotesFisicosController {
  constructor(private readonly service: BackofficeLotesFisicosService) {}

  @Get('unico')
  listarFisicosSinContable() {
    return this.service.listarFisicosSinContable();
  }

  @Get()
  listar(@Query() q: QueryBackofficeLotesFisicosDto) {
    return this.service.listar(q);
  }

  @Get(':id')
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalle(id);
  }
}

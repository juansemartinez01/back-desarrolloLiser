import { Controller, Get, Query } from '@nestjs/common';
import { QueryEstadoCuentaDto } from './dto/query-estado-cuenta.dto';
import { EstadoCuentaService } from './estado-cuenta.service';

@Controller('cc/estado')
export class EstadoCuentaController {
  constructor(private readonly service: EstadoCuentaService) {}

  @Get()
  async get(@Query() q: QueryEstadoCuentaDto) {
    return this.service.estadoCuenta(q);
  }
}

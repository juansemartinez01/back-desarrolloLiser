// src/modules/backoffice/cc/estado/bo-estado-cuenta.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { BoQueryEstadoCuentaDto } from './dto/bo-query-estado-cuenta.dto';
import { BoEstadoCuentaService } from './bo-estado-cuenta.service';

@Controller('backoffice/cc/estado')
export class BoEstadoCuentaController {
  constructor(private readonly service: BoEstadoCuentaService) {}

  @Get()
  get(@Query() q: BoQueryEstadoCuentaDto) {
    return this.service.estadoCuenta(q);
  }
}

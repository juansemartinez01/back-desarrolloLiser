import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { QueryEstadoCuentaDto } from './dto/query-estado-cuenta.dto';
import { EstadoCuentaService } from './estado-cuenta.service';

@Controller('cc/estado')
export class EstadoCuentaController {
  constructor(private readonly service: EstadoCuentaService) {}

  @Get()
  async get(@Query() q: QueryEstadoCuentaDto, @Req() req: Request) {
    // ✅ lee el valor REAL que llegó por querystring
    const includeMovsRaw = (req.query as any)?.include_movimientos;
    return this.service.estadoCuenta(q, includeMovsRaw);
  }
}

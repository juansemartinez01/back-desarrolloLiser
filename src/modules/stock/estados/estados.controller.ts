import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { QueryRemitosEstadoDto } from './dto/query-remitos-estado.dto';
import { EstadosService } from './estados.service';
import { ConciliarPendientesDto } from './dto/conciliar-pendientes.dto';

@Controller('stock')
export class EstadosController {
  constructor(private readonly service: EstadosService) {}

  // Listado de remitos con estado + métricas
  @Get('remitos')
  async listarRemitos(@Query() q: QueryRemitosEstadoDto) {
    return this.service.listarRemitosConEstado(q);
  }

  // Detalle de un remito (desglose por ítem)
  @Get('remitos/:id/estado')
  async detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalleRemito(id);
  }

  // Reporte de pendientes agrupados por producto
  @Get('pendientes')
  async pendientes() {
    return this.service.reportePendientes();
  }

  // Conciliación de pendientes contra lotes disponibles (opcional)
  @Post('pendientes/conciliar')
  async conciliar(@Body() dto: ConciliarPendientesDto) {
    return this.service.conciliarPendientes(dto);
  }
}

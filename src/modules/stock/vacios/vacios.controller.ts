import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { VaciosService } from './vacios.service';
import { CreateEnvaseDto } from './dto/create-envase.dto';
import { UpdateEnvaseDto } from './dto/update-envase.dto';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { QueryEstadoCuentaVaciosDto } from './dto/query-estado-cuenta-vacios.dto';

@Controller('admin/vacios')
export class VaciosController {
  constructor(private readonly svc: VaciosService) {}

  // -------- Envases (catálogo) --------
  @Get('envases')
  listEnvases() {
    return this.svc.listEnvases();
  }

  @Post('envases')
  createEnvase(@Body() dto: CreateEnvaseDto) {
    return this.svc.createEnvase(dto);
  }

  @Patch('envases/:id')
  updateEnvase(@Param('id') id: string, @Body() dto: UpdateEnvaseDto) {
    return this.svc.updateEnvase(Number(id), dto);
  }

  // -------- Movimientos / Saldos --------
  @Get('saldos')
  saldos(@Query('cliente_id') clienteId: string) {
    return this.svc.saldosCliente(Number(clienteId));
  }

  @Get('estado-cuenta')
  estadoCuenta(@Query() q: QueryEstadoCuentaVaciosDto) {
    return this.svc.estadoCuenta(q);
  }

  @Post('devolucion')
  devolucion(@Body() dto: RegistrarDevolucionDto) {
    return this.svc.registrarDevolucion(dto);
  }
}

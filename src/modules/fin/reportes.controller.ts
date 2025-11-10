import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ReportesFinService } from './reportes.service';

@Controller('fin/reportes')
export class ReportesFinController {
  constructor(private readonly service: ReportesFinService) {}

  @Get('saldos')
  saldos() {
    return this.service.saldosPorProveedor();
  }

  @Get('proveedores/:proveedorId/estado')
  estadoProveedor(@Param('proveedorId', ParseIntPipe) proveedorId: number) {
    return this.service.estadoProveedor(proveedorId);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import {
  QueryLibroIvaDto,
  QueryDashboardIvaDto,
} from './dto/query-libro-iva.dto';

@Controller('facturacion/reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  // Libro IVA Ventas (json|txt)
  // GET /facturacion/reportes/iva/ventas?desde=2025-11-01&hasta=2025-12-01&formato=txt
  @Get('iva/ventas')
  libroVentas(@Query() q: QueryLibroIvaDto) {
    return this.service.libroIvaVentas(q);
  }

  // Libro IVA Compras (json|txt)
  // GET /facturacion/reportes/iva/compras?desde=2025-11-01&hasta=2025-12-01&formato=txt
  @Get('iva/compras')
  libroCompras(@Query() q: QueryLibroIvaDto) {
    return this.service.libroIvaCompras(q);
  }

  // Dashboard IVA consolidado
  // GET /facturacion/reportes/iva/dashboard?desde=2025-11-01&hasta=2025-12-01
  @Get('iva/dashboard')
  dashboard(@Query() q: QueryDashboardIvaDto) {
    return this.service.dashboardIva(q);
  }
}

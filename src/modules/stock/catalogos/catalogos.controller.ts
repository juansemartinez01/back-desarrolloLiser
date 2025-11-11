// src/modules/stock/catalogos/catalogos.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { CatalogosService } from './catalogos.service';
import { QueryCatalogoDto } from '../dto/query-catalogo.dto';

@Controller('stock/catalogos')
export class CatalogosController {
  constructor(private readonly service: CatalogosService) {}

  // Para selector de proveedores
  @Get('proveedores')
  async proveedores(@Query() q: QueryCatalogoDto) {
    return this.service.listarProveedores(q);
  }

  // Para selector de conductores
  @Get('conductores')
  async conductores(@Query() q: QueryCatalogoDto) {
    return this.service.listarConductores(q);
  }
}

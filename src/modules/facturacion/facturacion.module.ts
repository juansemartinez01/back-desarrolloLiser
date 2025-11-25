import { Module } from '@nestjs/common';
import { FacturacionConfig } from './facturacion.config';
import { ApiLoggerService } from './services/api-logger.service';
import { FactuExternalClient } from './http/factu-external.client';
import { EmisoresController } from './emisores/emisores.controller';
import { EmisoresService } from './emisores/emisores.service';
import { FacturasService } from './facturas/facturas.service';
import { FacturasController } from './facturas/facturas.controller';
import { NotasService } from './notas/notas.service';
import { NotasController } from './notas/notas.controller';
import { ComprasController } from './compras/compras.controller';
import { ComprasService } from './compras/compras.service';
import { ReportesService } from './reportes/reportes.service';
import { ReportesController } from './reportes/reportes.controller';

@Module({
  providers: [
    FacturacionConfig,
    ApiLoggerService,
    FactuExternalClient,
    EmisoresService,
    FacturasService,
    NotasService,
    ComprasService,
    ReportesService,
  ],
  controllers: [
    EmisoresController,
    FacturasController,
    NotasController,
    ComprasController,
    ReportesController,
  ],
  exports: [
    FacturacionConfig,
    ApiLoggerService,
    FactuExternalClient,
    EmisoresService,
  ],
})
export class FacturacionModule {}

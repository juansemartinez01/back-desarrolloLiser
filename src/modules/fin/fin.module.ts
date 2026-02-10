import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Liquidacion } from './entities/liquidacion.entity';
import { LiquidacionDetalle } from './entities/liquidacion-detalle.entity';
import { Proveedor } from './entities/proveedor.entity';
import { LiquidacionesService } from './liquidaciones.service';
import { LiquidacionesController } from './liquidaciones.controller';
import { Pago } from './entities/pago.entity';
import { PagoAplic } from './entities/pago-aplic.entity';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';
import { ReportesFinService } from './reportes.service';
import { ReportesFinController } from './reportes.controller';
import { ProveedoresService } from './proveedores.service';
import { ProveedoresController } from './proveedores.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Proveedor,
      Liquidacion,
      LiquidacionDetalle,
      Pago,
      PagoAplic,
    ]),
  ],
  providers: [
    LiquidacionesService,
    PagosService,
    ReportesFinService,
    ProveedoresService,
  ],
  controllers: [
    LiquidacionesController,
    PagosController,
    ReportesFinController,
    ProveedoresController,
  ],
  exports: [
    LiquidacionesService,
    PagosService,
    ProveedoresService,
    ReportesFinService,
  ],
})
export class FinModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CcCliente } from './entities/cliente.entity';
import { CcCargo } from './entities/cargo.entity';
import { CcPago } from './entities/pago.entity';
import { CcPagoDet } from './entities/pago-det.entity';
import { CcAjuste } from './entities/ajuste.entity';
import { CargosController } from './cargos.controller';
import { CargosService } from './cargos.service';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { AjustesController } from './ajustes.controller';
import { AjustesService } from './ajustes.service';
import { EstadoCuentaService } from './estado-cuenta.service';
import { EstadoCuentaController } from './estado-cuenta.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CcCliente, CcCargo, CcPago, CcPagoDet, CcAjuste]),
  ],
  providers: [CargosService, PagosService,AjustesService,EstadoCuentaService],
  controllers: [CargosController, PagosController,AjustesController,EstadoCuentaController],
  exports: [EstadoCuentaService,ReportesService],
})
export class CcModule {}

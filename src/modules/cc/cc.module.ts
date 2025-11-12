import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CcCliente } from './entities/cliente.entity';
import { CcCargo } from './cargos/entities/cargo.entity';
import { CcPago } from './pagos/entities/pago.entity';
import { CcPagoDet } from './pagos/entities/pago-det.entity';
import { CcAjuste } from './ajustes/entities/ajuste.entity';
import { CargosController } from './cargos/cargos.controller';
import { CargosService } from './cargos/cargos.service';
import { PagosController } from './pagos/pagos.controller';
import { PagosService } from './pagos/pagos.service';
import { AjustesController } from './ajustes/ajustes.controller';
import { AjustesService } from './ajustes/ajustes.service';
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

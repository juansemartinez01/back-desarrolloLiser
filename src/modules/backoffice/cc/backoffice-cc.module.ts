// src/modules/backoffice/cc/backoffice-cc.module.ts
import { Module } from '@nestjs/common';
import { BoCargosController } from './cargos/bo-cargos.controller';
import { BoCargosService } from './cargos/bo-cargos.service';
import { BoPagosController } from './pagos/bo-pagos.controller';
import { BoPagosService } from './pagos/bo-pagos.service';
import { BoEstadoCuentaController } from './estado/bo-estado-cuenta.controller';
import { BoEstadoCuentaService } from './estado/bo-estado-cuenta.service';

@Module({
  controllers: [
    BoCargosController,
    BoPagosController,
    BoEstadoCuentaController,
  ],
  providers: [BoCargosService, BoPagosService, BoEstadoCuentaService],
})
export class BackofficeCcModule {}

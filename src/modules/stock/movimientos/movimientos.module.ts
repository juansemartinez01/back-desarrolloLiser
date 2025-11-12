// src/modules/stock/movimientos/movimientos.module.ts (ejemplo)
import { Module } from '@nestjs/common';
import { MovimientosConsultasService } from './movimientos-consultas.service';
import { MovimientosConsultasController } from './movimientos-consultas.controller';

@Module({
  controllers: [MovimientosConsultasController],
  providers: [MovimientosConsultasService],
  exports: [MovimientosConsultasService],
})
export class MovimientosModule {}

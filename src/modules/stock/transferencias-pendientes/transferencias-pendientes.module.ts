import { Module } from '@nestjs/common';
import { TransferenciasPendientesController } from './transferencias-pendientes.controller';
import { TransferenciasPendientesService } from './transferencias-pendientes.service';

@Module({
  controllers: [TransferenciasPendientesController],
  providers: [TransferenciasPendientesService],
  exports: [TransferenciasPendientesService],
})
export class TransferenciasPendientesModule {}

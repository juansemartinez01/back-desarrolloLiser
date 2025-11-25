import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AjusteCambioController } from './ajuste-cambio.controller';
import { AjusteCambioService } from './ajuste-cambio.service';
import { MovimientoStock } from '../movimientos/entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from '../movimientos/entities/movimiento-stock-detalle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MovimientoStock, MovimientoStockDetalle]),
  ],
  controllers: [AjusteCambioController],
  providers: [AjusteCambioService],
})
export class AjusteCambioModule {}

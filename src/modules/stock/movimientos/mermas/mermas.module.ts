// src/modules/stock/movimientos/mermas/mermas.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MermasController } from './mermas.controller';
import { MermasService } from './mermas.service';
import { MovimientoStock } from '../entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from '../entities/movimiento-stock-detalle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MovimientoStock, MovimientoStockDetalle]),
  ],
  controllers: [MermasController],
  providers: [MermasService],
  exports: [MermasService],
})
export class MermasModule {}

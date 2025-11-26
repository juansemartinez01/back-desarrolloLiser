import { Module } from '@nestjs/common';
import { EncontradosController } from './encontrados.controller';
import { EncontradosService } from './encontrados.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientoStock } from '../../movimientos/entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from '../../movimientos/entities/movimiento-stock-detalle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MovimientoStock, MovimientoStockDetalle]),
  ],
  controllers: [EncontradosController],
  providers: [EncontradosService],
})
export class EncontradosModule {}

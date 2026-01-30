import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaciosController } from './vacios.controller';
import { VaciosService } from './vacios.service';
import { Envase } from './entities/envase.entity';
import { MovimientoVacio } from './entities/movimiento-vacio.entity';
import { SaldoVaciosCliente } from './entities/saldo-vacios-cliente.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Envase, MovimientoVacio, SaldoVaciosCliente]),
  ],
  controllers: [VaciosController],
  providers: [VaciosService],
  exports: [VaciosService], // 👈 clave para usarlo desde VentasService
})
export class VaciosModule {}

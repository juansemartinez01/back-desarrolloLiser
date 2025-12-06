// src/caja/caja.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CajaApertura } from './entities/caja-apertura.entity';
import { CajaMovimiento } from './entities/caja-movimiento.entity';
import { CajaCierre } from './entities/caja-cierre.entity';
import { CajaService } from './caja.service';
import { CajaController } from './caja.controller';
import { Sucursal } from '../sucursales/sucursal.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CajaApertura, CajaMovimiento, CajaCierre,Sucursal]),
    
  ],
  controllers: [CajaController],
  providers: [CajaService],
})
export class CajaModule {}

// src/modules/stock/almacenes/almacenes.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Almacen } from './entities/almacen.entity';
import { AlmacenesService } from './almacenes.service';
import { AlmacenesController } from './almacenes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Almacen])],
  controllers: [AlmacenesController],
  providers: [AlmacenesService],
  exports: [AlmacenesService],
})
export class AlmacenesModule {}

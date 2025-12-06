// src/modules/stock/productos/productos.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './entities/producto.entity';
import { Unidad } from './entities/unidad.entity';
import { TipoProducto } from './entities/tipo-producto.entity';

import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';

import { UnidadesService } from './unidades.service';
import { UnidadesController } from './unidades.controller';

import { TiposProductoService } from './tipos-producto.service';
import { TiposProductoController } from './tipos-producto.controller';
import { ProductoPrecioHistorial } from './entities/producto-precio-historial.entity';
import { PrecioHistorialController } from './precio-historial.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Producto,
      Unidad,
      TipoProducto,
      ProductoPrecioHistorial,
    ]),
  ],
  controllers: [
    ProductosController,
    UnidadesController,
    TiposProductoController,
    PrecioHistorialController,
  ],
  providers: [ProductosService, UnidadesService, TiposProductoService],
  exports: [ProductosService, UnidadesService, TiposProductoService],
})
export class ProductosModule {}

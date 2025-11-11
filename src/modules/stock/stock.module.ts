import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { RemitosController } from './remitos.controller';
import { RemitosService } from './remitos.service';
import { Remito } from './entities/remito.entity';
import { RemitoItem } from './entities/remito-item.entity';
import { StockLote } from './entities/stock-lote.entity';
import { LoteAlmacen } from './entities/lote-almacen.entity';
import { MovimientoStock } from './entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from './entities/movimiento-stock-detalle.entity';
import { StockActual } from './entities/stock-actual.entity';
import { ConsumoPendiente } from './entities/consumo-pendiente.entity';
import { StockConsultasController } from './consultas.controller';
import { StockQueriesService } from './consultas.service';

import { EstadosController } from './estados.controller';
import { EstadosService } from './estados.service';
import { LotesController } from './lotes.controller';
import { LotesService } from './lotes.service';
import { TransferenciasController } from './transferencias.controller';
import { TransferenciasService } from './transferencias.service';
import { FraccionamientosController } from './fraccionamientos.controller';
import { FraccionamientosService } from './fraccionamientos.service';
import { ConteosController } from './conteos.controller';
import { ConteosService } from './conteos.service';
import { CatalogosController } from './catalogos/catalogos.controller';
import { CatalogosService } from './catalogos/catalogos.service';
import { ProductosModule } from './productos/productos.module';
import { LoteContable } from './entities/lote-contable.entity';
import { UnidadesController } from './productos/unidades.controller';
import { TiposProductoController } from './productos/tipos-producto.controller';
import { UnidadesService } from './productos/unidades.service';
import { TiposProductoService } from './productos/tipos-producto.service';
import { LotesContablesController } from './lotes-contables/lotes-contables.controller';
import { LotesContablesService } from './lotes-contables/lotes-contables.service';
import { LotesFisicosService } from './lotes-fisicos.service';
import { LotesFisicosController } from './lotes-fisicos.controller';
import { VentasController } from './movimientos/ventas.controller';
import { VentasService } from './movimientos/ventas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Remito,
      RemitoItem,
      StockLote,
      LoteAlmacen,
      MovimientoStock,
      MovimientoStockDetalle,
      StockActual,
      ConsumoPendiente,
      LoteContable,
    ]),
    ProductosModule,
  ],
  controllers: [
    StockController,
    RemitosController,
    StockConsultasController,
    VentasController,
    EstadosController,
    LotesController,
    TransferenciasController,
    FraccionamientosController,
    ConteosController,
    CatalogosController,
    UnidadesController,
    TiposProductoController,
    LotesContablesController,
    LotesFisicosController,
  ],
  providers: [
    StockService,
    RemitosService,
    StockQueriesService,
    VentasService,
    EstadosService,
    LotesService,
    TransferenciasService,
    FraccionamientosService,
    ConteosService,
    CatalogosService,
    UnidadesService,
    TiposProductoService,
    LotesContablesService,
    LotesFisicosService
  ],
  exports: [RemitosService, StockQueriesService, VentasService, EstadosService],
})
export class StockModule {}

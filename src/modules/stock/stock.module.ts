import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { RemitosController } from './remitos/remitos.controller';
import { RemitosService } from './remitos/remitos.service';
import { Remito } from './remitos/entities/remito.entity';
import { RemitoItem } from './remitos/entities/remito-item.entity';
import { StockLote } from './stock-actual/entities/stock-lote.entity';
import { LoteAlmacen } from './lotes-fisicos/entities/lote-almacen.entity';
import { MovimientoStock } from './movimientos/entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from './movimientos/entities/movimiento-stock-detalle.entity';
import { StockActual } from './stock-actual/entities/stock-actual.entity';
import { ConsumoPendiente } from './entities/consumo-pendiente.entity';
import { StockConsultasController } from './consultas/consultas.controller';
import { StockQueriesService } from './consultas/consultas.service';

import { EstadosController } from './estados/estados.controller';
import { EstadosService } from './estados/estados.service';
import { LotesController } from './lotes/lotes.controller';
import { LotesService } from './lotes/lotes.service';
import { TransferenciasController } from './transferencias/transferencias.controller';
import { TransferenciasService } from './transferencias/transferencias.service';
import { FraccionamientosController } from './fraccionamientos/fraccionamientos.controller';
import { FraccionamientosService } from './fraccionamientos/fraccionamientos.service';
import { ConteosController } from './conteos/conteos.controller';
import { ConteosService } from './conteos/conteos.service';
import { CatalogosController } from './catalogos/catalogos.controller';
import { CatalogosService } from './catalogos/catalogos.service';
import { ProductosModule } from './productos/productos.module';
import { LoteContable } from './lotes-contables/entities/lote-contable.entity';
import { UnidadesController } from './productos/unidades.controller';
import { TiposProductoController } from './productos/tipos-producto.controller';
import { UnidadesService } from './productos/unidades.service';
import { TiposProductoService } from './productos/tipos-producto.service';
import { LotesContablesController } from './lotes-contables/lotes-contables.controller';
import { LotesContablesService } from './lotes-contables/lotes-contables.service';
import { LotesFisicosService } from './lotes-fisicos/lotes-fisicos.service';
import { LotesFisicosController } from './lotes-fisicos/lotes-fisicos.controller';
import { VentasController } from './movimientos/ventas.controller';
import { VentasService } from './movimientos/ventas.service';
import { MovimientosModule } from './movimientos/movimientos.module';
import { Almacen } from './almacenes/entities/almacen.entity';
import { AlmacenesModule } from './almacenes/almacenes.module';
import { MermasModule } from './movimientos/mermas/mermas.module';

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
    MovimientosModule,
    AlmacenesModule,
    MermasModule,
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
    LotesFisicosService,
  ],
  exports: [RemitosService, StockQueriesService, VentasService, EstadosService],
})
export class StockModule {}

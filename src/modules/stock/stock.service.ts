import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Remito } from './remitos/entities/remito.entity';
import { RemitoItem } from './remitos/entities/remito-item.entity';
import { StockLote } from './stock-actual/entities/stock-lote.entity';
import { LoteAlmacen } from './lotes-fisicos/entities/lote-almacen.entity';
import { MovimientoStock } from './movimientos/entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from './movimientos/entities/movimiento-stock-detalle.entity';
import { StockActual } from './stock-actual/entities/stock-actual.entity';
import { ConsumoPendiente } from './entities/consumo-pendiente.entity';


@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Remito) private remitos: Repository<Remito>,
    @InjectRepository(RemitoItem) private remitoItems: Repository<RemitoItem>,
    @InjectRepository(StockLote) private lotes: Repository<StockLote>,
    @InjectRepository(LoteAlmacen) private loteAlmacen: Repository<LoteAlmacen>,
    @InjectRepository(MovimientoStock)
    private movs: Repository<MovimientoStock>,
    @InjectRepository(MovimientoStockDetalle)
    private movDets: Repository<MovimientoStockDetalle>,
    @InjectRepository(StockActual) private stockActual: Repository<StockActual>,
    @InjectRepository(ConsumoPendiente)
    private pendientes: Repository<ConsumoPendiente>,
  ) {}

  
  
  async health() {
    return { ok: true };
  }
}



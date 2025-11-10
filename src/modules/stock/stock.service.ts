import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Remito } from './entities/remito.entity';
import { RemitoItem } from './entities/remito-item.entity';
import { StockLote } from './entities/stock-lote.entity';
import { LoteAlmacen } from './entities/lote-almacen.entity';
import { MovimientoStock } from './entities/movimiento-stock.entity';
import { MovimientoStockDetalle } from './entities/movimiento-stock-detalle.entity';
import { StockActual } from './entities/stock-actual.entity';
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



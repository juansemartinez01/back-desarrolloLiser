import { Controller, Get, Query } from '@nestjs/common';
import { StockQueriesService } from '../consultas/consultas.service';
import { QueryStockActualDto } from '../stock-actual/dto/query-stock-actual.dto';
import { QueryKardexDto } from '../dto/query-kardex.dto';
import { QueryLotesPorProductoDto } from './dto/query-lotes-por-producto.dto';

@Controller('stock')
export class StockConsultasController {
  constructor(private readonly service: StockQueriesService) {}

  @Get('stock-actual')
  async stockActual(@Query() q: QueryStockActualDto) {
    return this.service.getStockActual(q);
  }

  @Get('lotes-por-producto')
  async lotesPorProducto(@Query() q: QueryLotesPorProductoDto) {
    return this.service.lotesPorProducto(q);
  }

  @Get('kardex')
  async kardex(@Query() q: QueryKardexDto) {
    return this.service.getKardex(q);
  }
}

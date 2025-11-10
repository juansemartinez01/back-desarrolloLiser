import { Controller, Get, Query } from '@nestjs/common';
import { StockQueriesService } from './consultas.service';
import { QueryStockActualDto } from './dto/query-stock-actual.dto';
import { QueryKardexDto } from './dto/query-kardex.dto';

@Controller('stock')
export class StockConsultasController {
  constructor(private readonly service: StockQueriesService) {}

  @Get('stock-actual')
  async stockActual(@Query() q: QueryStockActualDto) {
    return this.service.getStockActual(q);
  }

  @Get('kardex')
  async kardex(@Query() q: QueryKardexDto) {
    return this.service.getKardex(q);
  }
}

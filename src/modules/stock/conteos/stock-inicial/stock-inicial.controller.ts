import { Controller, Get, Query } from '@nestjs/common';
import { StockInicialService } from './stock-inicial.service';
import { QueryStockInicialDto } from './dto/query-stock-inicial.dto';

@Controller('stock/inicial')
export class StockInicialController {
  constructor(private readonly service: StockInicialService) {}

  @Get()
  async obtener(@Query() q: QueryStockInicialDto) {
    return this.service.obtenerStockInicialFormateado(q);
  }
}

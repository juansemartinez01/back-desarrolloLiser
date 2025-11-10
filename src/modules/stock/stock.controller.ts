import { Controller, Get } from '@nestjs/common';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly service: StockService) {}

  
  @Get('health')
  health() {
    return this.service.health();
  }
}

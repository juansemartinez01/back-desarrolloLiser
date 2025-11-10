import { Body, Controller, Post } from '@nestjs/common';
import { ConsumoVentaDto } from './dto/consumo-venta.dto';
import { VentasService } from './ventas.service';

@Controller('stock/consumos')
export class VentasConsumoController {
  constructor(private readonly service: VentasService) {}

  // Consumo FIFO por documento de venta (varias líneas)
  @Post('venta')
  async consumirVenta(@Body() dto: ConsumoVentaDto) {
    return this.service.consumirVenta(dto);
  }
}

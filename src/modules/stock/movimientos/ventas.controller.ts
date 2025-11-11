import { Body, Controller, Post } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { RegistrarVentaDto } from './dto/venta.dto';

@Controller('stock/movimientos')
export class VentasController {
  constructor(private readonly service: VentasService) {}

  @Post('venta')
  async registrar(@Body() dto: RegistrarVentaDto) {
    return this.service.registrarVenta(dto);
  }
}

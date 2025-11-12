import { Body, Controller, Post } from '@nestjs/common';
import { FraccionamientosService } from './fraccionamientos.service';
import { FraccionamientoDto } from './dto/fraccionamiento.dto';
import { FraccionamientoFactorDto } from './dto/fraccionamiento-factor.dto';

@Controller('stock/fraccionamientos')
export class FraccionamientosController {
  constructor(
    private readonly fraccionamientosService: FraccionamientosService,
  ) {}

  @Post()
  async crear(@Body() dto: FraccionamientoDto) {
    return this.fraccionamientosService.fraccionar(dto);
  }

  // 🔹 Nuevo: fraccionar multiplicando unidades (ej: 60 → 240)
  @Post('factor')
  async crearConFactor(@Body() dto: FraccionamientoFactorDto) {
    return this.fraccionamientosService.fraccionarConFactor(dto);
  }
}

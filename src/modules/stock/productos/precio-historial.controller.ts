// src/modules/stock/productos/precio-historial.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProductoPrecioHistorial } from './entities/producto-precio-historial.entity';

@Controller('productos/historial')
export class PrecioHistorialController {
  constructor(private readonly ds: DataSource) {}

  @Get(':codigo')
  async obtenerHistorial(@Param('codigo') codigo: string) {
    const repo = this.ds.getRepository(ProductoPrecioHistorial);
    return repo.find({
      where: { codigo_comercial: codigo },
      order: { fecha_cambio: 'DESC' },
    });
  }
}

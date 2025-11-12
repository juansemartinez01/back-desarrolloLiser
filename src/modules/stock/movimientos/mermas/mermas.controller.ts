// src/modules/stock/movimientos/mermas/mermas.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { MermasService } from './mermas.service';
import { RegistrarMermaDto } from './dto/registrar-merma.dto';

@Controller('stock/movimientos/mermas')
export class MermasController {
  constructor(private readonly service: MermasService) {}

  @Post()
  async registrar(@Body() dto: RegistrarMermaDto) {
    return this.service.registrarMerma(dto);
  }
}

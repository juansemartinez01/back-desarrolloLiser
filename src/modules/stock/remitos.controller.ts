import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateRemitoDto } from './dto/create-remito.dto';
import { RemitosService } from './remitos.service';
import { CreateDistribucionRemitoDto } from './dto/distribucion-remito.dto';
import { IngresoRapidoRemitoDto } from './dto/ingreso-rapido-remito.dto';
import { CompletarRemitoContableDto } from './dto/completar-remito-contable.dto';

@Controller('stock/remitos')
export class RemitosController {
  constructor(private readonly service: RemitosService) {}

  @Post()
  async crear(@Body() dto: CreateRemitoDto) {
    return this.service.crearRemito(dto);
  }

  @Post('ingreso-rapido')
  async ingresoRapido(@Body() dto: IngresoRapidoRemitoDto) {
    console.log('>>> HIT ingreso-rapido', JSON.stringify(dto));
    return this.service.crearRemitoIngresoRapido(dto);
  }

  @Get(':id')
  async detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obtenerDetalle(id);
  }

  @Post(':id/distribucion')
  async distribuir(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateDistribucionRemitoDto,
  ) {
    console.log('>>> HIT Ingreso distribucion', JSON.stringify(dto));
    return this.service.distribuirRemito(id, dto);
  }

  @Patch(':id/contable')
  async completarContable(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompletarRemitoContableDto,
  ) {
    return this.service.completarRemitoContable(id, dto);
  }
}

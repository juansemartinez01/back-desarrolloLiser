import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateRemitoDto } from './dto/create-remito.dto';
import { RemitosService } from './remitos.service';
import { CreateDistribucionRemitoDto } from './dto/distribucion-remito.dto';
import { IngresoRapidoRemitoDto } from './dto/ingreso-rapido-remito.dto';

@Controller('stock/remitos')
export class RemitosController {
  constructor(private readonly service: RemitosService) {}

  @Post('ingreso-rapido')
  async ingresoRapido(@Body() dto: IngresoRapidoRemitoDto) {
    return this.service.crearRemitoIngresoRapido(dto);
  }
  
  @Post()
  async crear(@Body() dto: CreateRemitoDto) {
    return this.service.crearRemito(dto);
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
    return this.service.distribuirRemito(id, dto);
  }
}

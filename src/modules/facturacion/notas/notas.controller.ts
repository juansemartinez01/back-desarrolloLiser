import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { NotasService } from './notas.service';
import { CreateNotaDto } from './dto/create-nota.dto';

@Controller('facturacion/notas')
export class NotasController {
  constructor(private readonly service: NotasService) {}

  // Atajos directos
  @Post('credito')
  emitirNC(@Body() dto: CreateNotaDto) {
    return this.service.emitirNC(dto);
  }

  @Post('debito')
  emitirND(@Body() dto: CreateNotaDto) {
    return this.service.emitirND(dto);
  }

  // Atajos por id local de factura original (más “friendly” para UI)
  @Post('credito/desde/:facturaId')
  emitirNCDesdeFactura(
    @Param('facturaId', new ParseUUIDPipe()) facturaId: string,
    @Body() dto: Omit<CreateNotaDto, 'factura_original_id'>,
  ) {
    return this.service.emitirNC({ ...dto, factura_original_id: facturaId });
  }

  @Post('debito/desde/:facturaId')
  emitirNDDesdeFactura(
    @Param('facturaId', new ParseUUIDPipe()) facturaId: string,
    @Body() dto: Omit<CreateNotaDto, 'factura_original_id'>,
  ) {
    return this.service.emitirND({ ...dto, factura_original_id: facturaId });
  }
}

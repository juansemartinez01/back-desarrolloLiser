import { Body, Controller, Param, Patch } from '@nestjs/common';
import { LotesService } from './lotes.service';
import { UpdateLoteBloqueoDto } from './dto/update-lote-bloqueo.dto';

@Controller('stock/lotes')
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Patch(':id/bloqueo')
  async setBloqueo(@Param('id') id: string, @Body() dto: UpdateLoteBloqueoDto) {
    return this.lotesService.setBloqueoLote(id, dto.bloqueado);
  }
}

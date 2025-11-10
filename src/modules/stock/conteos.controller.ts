import { Body, Controller, Post } from '@nestjs/common';
import { ConteosService } from './conteos.service';
import { ConteoAjusteDto } from './dto/conteo-ajuste.dto';

@Controller('stock/conteos')
export class ConteosController {
  constructor(private readonly conteosService: ConteosService) {}

  @Post('ajustar')
  async ajustar(@Body() dto: ConteoAjusteDto) {
    return this.conteosService.ajustarPorConteo(dto);
  }
}

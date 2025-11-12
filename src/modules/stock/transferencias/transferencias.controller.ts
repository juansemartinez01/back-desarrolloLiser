import { Body, Controller, Post } from '@nestjs/common';
import { TransferenciasService } from './transferencias.service';
import { TransferenciaDto } from './dto/transferencia.dto';

@Controller('stock/transferencias')
export class TransferenciasController {
  constructor(private readonly transferenciasService: TransferenciasService) {}

  @Post()
  async crear(@Body() dto: TransferenciaDto) {
    return this.transferenciasService.transferir(dto);
  }
}

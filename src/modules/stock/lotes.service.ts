import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StockLote } from './entities/stock-lote.entity';

@Injectable()
export class LotesService {
  constructor(private readonly ds: DataSource) {}

  async setBloqueoLote(id: string, bloqueado: boolean) {
    const repo = this.ds.getRepository(StockLote);

    const lote = await repo.findOne({ where: { id } });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    lote.bloqueado = bloqueado;
    await repo.save(lote);

    return {
      ok: true,
      id: lote.id,
      bloqueado: lote.bloqueado,
    };
  }
}

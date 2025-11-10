// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { DataSource, Repository } from 'typeorm';
// import { Outbox } from './outbox.entity';

// @Injectable()
// export class OutboxService {
//   constructor(
//     @InjectRepository(Outbox) private readonly repo: Repository<Outbox>,
//     private readonly dataSource: DataSource,
//   ) {}

//   /** Encola un evento en estado pendiente (processed_at = null, attempts = 0). */
//   async enqueue(type: string, payload: any): Promise<Outbox> {
//     const rec = this.repo.create({
//       type,
//       payload,
//       processed_at: null,
//       attempts: 0,
//     });
//     return this.repo.save(rec);
//   }

//   /** Lista pendientes sin lock (para monitoreo / debugging). */
//   async findPending(limit = 50): Promise<Outbox[]> {
//     return this.repo.find({
//       where: { processed_at: null },
//       order: { id: 'ASC' },
//       take: limit,
//     });
//   }

//   /**
//    * Reclama en forma atómica un batch de pendientes para procesar.
//    * Usa SKIP LOCKED para permitir workers paralelos.
//    * Devuelve el lote ya “claimado” (con attempts incrementado).
//    */
//   async claimPendingBatch(limit = 100): Promise<Outbox[]> {
//     const sql = `
//       WITH cte AS (
//         SELECT id
//         FROM outbox
//         WHERE processed_at IS NULL
//         ORDER BY created_at
//         FOR UPDATE SKIP LOCKED
//         LIMIT $1
//       )
//       UPDATE outbox o
//       SET attempts = attempts + 1, updated_at = NOW()
//       FROM cte
//       WHERE o.id = cte.id
//       RETURNING o.*;
//     `;
//     const rows = await this.dataSource.query(sql, [limit]);
//     return rows as Outbox[];
//   }

//   /** Marca un evento como procesado. */
//   async markProcessed(id: number): Promise<void> {
//     await this.repo.update({ id }, { processed_at: new Date() });
//   }

//   /** Marca un intento fallido (solo incrementa attempts). */
//   async markFailed(id: number): Promise<void> {
//     await this.repo
//       .createQueryBuilder()
//       .update(Outbox)
//       .set({ attempts: () => 'attempts + 1' })
//       .where('id = :id', { id })
//       .execute();
//   }

//   /** Limpieza opcional: borra procesados viejos (por días). */
//   async purgeProcessedOlderThan(days = 30): Promise<number> {
//     const res = await this.repo
//       .createQueryBuilder()
//       .delete()
//       .from(Outbox)
//       .where('processed_at IS NOT NULL')
//       .andWhere('processed_at < NOW() - INTERVAL :days DAY', { days })
//       .execute();
//     return res.affected ?? 0;
//   }
// }

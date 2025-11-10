// import { Injectable, Logger } from '@nestjs/common';
// import { OutboxService } from './outbox.service';
// import { Outbox } from './outbox.entity';

// @Injectable()
// export class OutboxPublisher {
//   private readonly logger = new Logger(OutboxPublisher.name);

//   constructor(private readonly outbox: OutboxService) {}

//   /**
//    * Publica un batch de eventos pendientes:
//    * - Reclama un lote (claimPendingBatch)
//    * - Intenta publicar cada uno
//    * - Si ok => markProcessed
//    * - Si falla => markFailed (sólo incrementa attempts y loguea)
//    */
//   async publishPendingBatch(
//     limit = 100,
//   ): Promise<{ claimed: number; ok: number; failed: number }> {
//     const batch = await this.outbox.claimPendingBatch(limit);
//     let ok = 0;
//     let failed = 0;

//     for (const evt of batch) {
//       try {
//         await this.publishOne(evt); // <-- tu lógica real de publicación
//         await this.outbox.markProcessed(evt.id);
//         ok++;
//       } catch (e) {
//         this.logger.error(
//           `publish failed id=${evt.id} type=${evt.type}: ${e instanceof Error ? e.message : e}`,
//         );
//         await this.outbox.markFailed(evt.id);
//         failed++;
//       }
//     }
//     this.logger.debug(
//       `publishPendingBatch: claimed=${batch.length} ok=${ok} failed=${failed}`,
//     );
//     return { claimed: batch.length, ok, failed };
//   }

//   /**
//    * Implementá acá la publicación real (Kafka, SNS/SQS, Webhook, etc.)
//    * Por ahora, stub: sólo loguea.
//    */
//   private async publishOne(evt: Outbox): Promise<void> {
//     // Ejemplo de routing por tipo
//     // switch (evt.type) {
//     //   case 'pedido.creado': await this.kafka.emit('pedido.creado', evt.payload); break;
//     //   default: throw new Error(`Tipo no soportado: ${evt.type}`);
//     // }
//     this.logger.verbose(
//       `Publishing [${evt.type}] payload=${JSON.stringify(evt.payload)}`,
//     );
//   }
// }

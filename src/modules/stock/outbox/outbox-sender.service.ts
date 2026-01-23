// admin/src/outbox/outbox-sender.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios from 'axios';

@Injectable()
export class OutboxSenderService {
  private readonly log = new Logger(OutboxSenderService.name);

  constructor(private readonly ds: DataSource) {}

  private backoffMinutes(attempts: number) {
    // 1, 2, 5, 10, 30, 60...
    const seq = [1, 2, 5, 10, 30, 60];
    return seq[Math.min(attempts, seq.length - 1)];
  }

  async processOnce(limit = 20) {
    const repo = this.ds.getRepository('outbox_events');

    // Traer pendientes listos para retry
    const rows = await this.ds.query(
      `
      SELECT *
      FROM public.outbox_events
      WHERE status IN ('PENDING','FAILED')
        AND next_retry_at <= now()
      ORDER BY created_at ASC
      LIMIT $1
      `,
      [limit],
    );

    for (const ev of rows) {
      try {
        if (ev.event_type === 'PRODUCTO_UPSERT_VENTAS') {
          await axios.post(
            `${process.env.VENTAS_API_BASE}/integraciones/productos/upsert`,
            ev.payload,
            { headers: { 'x-api-key': process.env.VENTAS_API_KEY } },
          );
        }

        await this.ds.query(
          `UPDATE public.outbox_events
           SET status='SENT', updated_at=now(), last_error=NULL
           WHERE id=$1`,
          [ev.id],
        );
      } catch (e: any) {
        const attempts = Number(ev.attempts || 0) + 1;
        const mins = this.backoffMinutes(attempts);
        const msg = e?.response?.data
          ? JSON.stringify(e.response.data)
          : e?.message || 'error';

        await this.ds.query(
          `UPDATE public.outbox_events
           SET status='FAILED',
               attempts=$2,
               last_error=$3,
               next_retry_at=now() + ($4 || ' minutes')::interval,
               updated_at=now()
           WHERE id=$1`,
          [ev.id, attempts, msg.slice(0, 2000), mins],
        );

        this.log.warn(`Outbox ${ev.id} FAILED attempts=${attempts}: ${msg}`);
      }
    }

    return { processed: rows.length };
  }
}

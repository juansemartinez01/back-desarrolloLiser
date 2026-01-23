// admin/src/outbox/outbox-cron.service.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OutboxSenderService } from './outbox-sender.service';

@Injectable()
export class OutboxCronService {
  constructor(private readonly sender: OutboxSenderService) {}

  @Cron('*/15 * * * * *') // cada 15 segundos
  async tick() {
    await this.sender.processOnce(30);
  }
}

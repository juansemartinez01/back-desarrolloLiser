// admin/src/outbox/outbox-cron.service.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OutboxSenderService } from './outbox-sender.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class OutboxCronService {
  private readonly log = new Logger(OutboxCronService.name);
  constructor(private readonly sender: OutboxSenderService) {}

  @Cron('*/15 * * * * *') // cada 15 segundos
  async tick() {
    this.log.log('tick outbox');
    await this.sender.processOnce(30);
  }
}

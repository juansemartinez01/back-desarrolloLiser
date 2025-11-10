// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly ds: DataSource) {}
  @Get('live') liveness() {
    return { ok: true };
  }
  @Get('ready') async readiness() {
    await this.ds.query('SELECT 1');
    return { ok: true };
  }
}

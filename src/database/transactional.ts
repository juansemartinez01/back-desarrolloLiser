// src/common/database/transactional.ts
import { DataSource, QueryRunner } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UnitOfWork {
  constructor(private readonly ds: DataSource) {}

  async withTransaction<T>(fn: (qr: QueryRunner) => Promise<T>): Promise<T> {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const result = await fn(qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}

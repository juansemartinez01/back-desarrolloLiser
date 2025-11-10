import { CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm';

export abstract class BaseAuditEntity {
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @VersionColumn()
  version: number;
}

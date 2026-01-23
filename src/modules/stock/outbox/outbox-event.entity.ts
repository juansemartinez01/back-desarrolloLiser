// admin/src/outbox/outbox-event.entity.ts
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('outbox_events')
@Index(['status', 'next_retry_at'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60 })
  aggregate_type: string;

  @Column({ type: 'varchar', length: 80 })
  aggregate_id: string;

  @Column({ type: 'varchar', length: 60 })
  event_type: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: 'PENDING' | 'SENT' | 'FAILED';

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  last_error?: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  next_retry_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

// src/outbox/outbox.entity.ts
import { BaseEntity } from '../entities/base.entity';
import { Column, Entity, Index } from 'typeorm';

@Entity('outbox')
export class Outbox extends BaseEntity {
  @Column('text') type: string; // nombre del evento
  @Column('jsonb') payload: any; // datos del evento
  @Column('timestamptz', { nullable: true }) processed_at: Date | null;
  @Index()
  @Column('int', { default: 0 })
  attempts: number;
}

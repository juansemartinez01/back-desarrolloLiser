import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Envase } from './envase.entity';

@Entity('saldo_vacios_cliente')
export class SaldoVaciosCliente {
  @PrimaryColumn({ type: 'int' })
  cliente_id: number;

  @PrimaryColumn({ type: 'bigint' })
  envase_id: string;

  @ManyToOne(() => Envase, { eager: false })
  @JoinColumn({ name: 'envase_id' })
  envase: Envase;

  @Column({ type: 'numeric', precision: 14, scale: 3, default: 0 })
  saldo_cantidad: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

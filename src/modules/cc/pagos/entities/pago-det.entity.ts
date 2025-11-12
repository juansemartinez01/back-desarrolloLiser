import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';
import { CcPago } from './pago.entity';
import { CcCargo } from '../../cargos/entities/cargo.entity';

@Entity('cc_pagos_det')
export class CcPagoDet extends BaseEntity {
  @ManyToOne(() => CcPago, (p) => p.aplicaciones, { onDelete: 'CASCADE' })
  pago: CcPago;

  @ManyToOne(() => CcCargo, { onDelete: 'RESTRICT' })
  cargo: CcCargo;

  @Index()
  @Column({ type: 'uuid' })
  pago_id: string;

  @Index()
  @Column({ type: 'uuid' })
  cargo_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  importe: string;
}

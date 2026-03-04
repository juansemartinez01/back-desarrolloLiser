import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';
import { CcCliente } from '../../clientes/entities/cliente.entity';
import { PagoCuenta } from '../../enums/pago-cuenta.enum';
import { CcPagoDet } from '../../pagos/entities/pago-det.entity';

@Entity('cc_pagos')
export class CcPago extends BaseEntity {
  @Index()
  @Column({ type: 'timestamptz' })
  fecha: Date;

  @ManyToOne(() => CcCliente, { onDelete: 'RESTRICT' })
  cliente: CcCliente;

  @Index()
  @Column({ type: 'uuid' })
  cliente_id: string;

  @Index()
  @Column({ type: 'enum', enum: PagoCuenta, enumName: 'cc_pago_cuenta' })
  cuenta: PagoCuenta;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  importe: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia_externa?: string | null;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;

  // ✅ NUEVO
  @Index()
  @Column({ type: 'varchar', length: 60, nullable: true })
  metodo_pago?: string | null;

  // ✅ NUEVO
  @Column({ type: 'varchar', length: 300, nullable: true })
  datos_pago?: string | null;

  @OneToMany(() => CcPagoDet, (d) => d.pago)
  aplicaciones: CcPagoDet[];
}

import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { PagoAplic } from './pago-aplic.entity';

export enum PagoEstado {
  REGISTRADO = 'REGISTRADO',
  ANULADO = 'ANULADO',
}

@Entity('fin_pagos')
export class Pago extends BaseEntity {
  @Index() @Column({ type: 'int' }) proveedor_id: number;
  @Index() @Column({ type: 'timestamptz' }) fecha: Date;
  @Index()
  @Column({ type: 'varchar', length: 20, default: PagoEstado.REGISTRADO })
  estado: PagoEstado;

  @Column({ type: 'numeric', precision: 18, scale: 4 }) monto_total: string;
  @Column({ type: 'varchar', length: 120, nullable: true })
  referencia_externa?: string | null;
  @Column({ type: 'text', nullable: true }) observacion?: string | null;

  @OneToMany(() => PagoAplic, (a) => a.pago) aplicaciones: PagoAplic[];
}

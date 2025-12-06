// src/caja/entities/caja-cierre.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { CajaApertura } from './caja-apertura.entity';

@Entity('caja_cierre')
export class CajaCierre {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CajaApertura, (a) => a.cierres, { eager: false })
  apertura: CajaApertura;

  @Column({ type: 'timestamptz' })
  fechaCierre: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  totalTeorico: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  totalRealEfectivo: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  diferencia: number;

  @Column({ type: 'varchar', nullable: true })
  observaciones: string;

  @Column()
  usuarioCierre: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalEfectivo: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalTarjetas: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalTransferencias: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalBilleteras: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalCheques: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalCuentaCorriente: number;
}

// src/caja/entities/caja-apertura.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne } from 'typeorm';
import { CajaMovimiento } from './caja-movimiento.entity';
import { CajaCierre } from './caja-cierre.entity';
import { Sucursal } from 'src/modules/sucursales/sucursal.entity';

@Entity('caja_apertura')
export class CajaApertura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  fechaApertura: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  saldoInicial: number;

  @Column()
  usuarioApertura: string;

  @Column({ default: true })
  abierta: boolean;

  @OneToMany(() => CajaMovimiento, (m) => m.apertura)
  movimientos: CajaMovimiento[];

  @OneToMany(() => CajaCierre, (c) => c.apertura)
  cierres: CajaCierre[];

  // src/caja/entities/caja-apertura.entity.ts
  @ManyToOne(() => Sucursal, (suc) => suc.aperturas, { eager: true })
  sucursal: Sucursal;

  @Column()
  sucursalId: string;
}

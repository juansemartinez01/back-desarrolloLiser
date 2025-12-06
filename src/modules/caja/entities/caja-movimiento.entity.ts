// src/caja/entities/caja-movimiento.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { CajaApertura } from './caja-apertura.entity';
import { TipoMovimiento } from '../enums/tipo-movimiento.enum';
import { MetodoPago } from '../enums/metodo-pago.enum';
import { TarjetaTipo } from '../enums/tarjeta-tipo.enum';

@Entity('caja_movimiento')
export class CajaMovimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CajaApertura, (a) => a.movimientos, { eager: false })
  apertura: CajaApertura;

  @Column({ type: 'timestamptz' })
  fecha: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto: number;

  

  @Column({ type: 'enum', enum: TipoMovimiento })
  tipo: TipoMovimiento;

  @Column({ type: 'varchar', nullable: true })
  referencia: string;

  @Column()
  usuario: string;

  @Column({ type: 'enum', enum: MetodoPago })
  metodoPago: MetodoPago;

  @Column({ type: 'enum', enum: TarjetaTipo, nullable: true })
  tarjetaTipo?: TarjetaTipo;

  @Column({ nullable: true })
  tarjetaUltimos4?: string;

  @Column({ nullable: true })
  codigoAutorizacion?: string;

  @Column({ nullable: true })
  nombreEntidad?: string; // banco o billetera, ej:"MercadoPago"
}

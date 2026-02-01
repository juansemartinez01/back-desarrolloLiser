import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { CajaMovimiento } from './caja-movimiento.entity';
import { MetodoPago } from '../enums/metodo-pago.enum';
import { TarjetaTipo } from '../enums/tarjeta-tipo.enum';

@Entity('caja_movimiento_detalle')
@Index('ix_caja_mov_det_mov', ['movimientoId'])
@Index('ix_caja_mov_det_metodo', ['metodoPago'])
export class CajaMovimientoDetalle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  movimientoId: string;

  @ManyToOne(() => CajaMovimiento, (m) => m.detalles, { onDelete: 'CASCADE' })
  movimiento: CajaMovimiento;

  @Column({ type: 'enum', enum: MetodoPago })
  metodoPago: MetodoPago;

  // siempre POSITIVO. El signo lo define el movimiento.tipo (INGRESO/EGRESO)
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto: number;

  // --- Campos opcionales por método ---
  @Column({ type: 'enum', enum: TarjetaTipo, nullable: true })
  tarjetaTipo?: TarjetaTipo;

  @Column({ nullable: true })
  tarjetaUltimos4?: string;

  @Column({ nullable: true })
  codigoAutorizacion?: string;

  @Column({ nullable: true })
  nombreEntidad?: string; // Banco / billetera / etc.
}

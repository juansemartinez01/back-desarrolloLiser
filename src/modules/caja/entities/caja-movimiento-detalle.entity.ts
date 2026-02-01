import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
  JoinColumn,
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

  // ✅ en DB es movimiento_id
  @Column({ type: 'uuid', name: 'movimiento_id' })
  movimientoId: string;

  @ManyToOne(() => CajaMovimiento, (m) => m.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movimiento_id' }) // ✅ clave
  movimiento: CajaMovimiento;

  // OJO: si en DB es varchar (como te mostraba information_schema),
  // dejalo como varchar para NO forzar enum en Postgres con synchronize.
  @Column({ type: 'varchar', name: 'metodo_pago' })
  metodoPago: MetodoPago;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto: number;

  @Column({ type: 'varchar', nullable: true, name: 'tarjeta_tipo' })
  tarjetaTipo?: TarjetaTipo;

  // CajaMovimientoDetalle

  @Column({ type: 'varchar', length: 4, nullable: true })
  tarjetaUltimos4?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  codigoAutorizacion?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  nombreEntidad?: string | null;
}

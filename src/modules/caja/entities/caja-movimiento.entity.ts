import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { CajaApertura } from './caja-apertura.entity';
import { TipoMovimiento } from '../enums/tipo-movimiento.enum';
import { MetodoPago } from '../enums/metodo-pago.enum';
import { TarjetaTipo } from '../enums/tarjeta-tipo.enum';
import { CajaMovimientoDetalle } from './caja-movimiento-detalle.entity';

@Entity('caja_movimiento')
export class CajaMovimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'apertura_id' })
  aperturaId: string;

  @ManyToOne(() => CajaApertura, (a) => a.movimientos, { eager: false })
  @JoinColumn({ name: 'apertura_id' }) // ✅ clave
  apertura: CajaApertura;

  @Column({ type: 'timestamptz' })
  fecha: Date;

  // ⚠️ si este campo existe en DB y es NOT NULL, hoy NO lo estás seteando.
  // Solución: hacerlo nullable (mínimo) o setearlo en service.
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  monto: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  montoTotal: number;

  @Column({ type: 'varchar' })
  tipo: TipoMovimiento;

  @Column({ nullable: true })
  referencia: string | null;

  @Column()
  usuario: string;

  // ⚠️ este campo era del modelo viejo (un solo método).
  // Si sigue existiendo en DB y es NOT NULL, te rompe.
  // Solución: nullable + lo dejamos como “resumen” opcional.
  @Column({ type: 'varchar', nullable: true, name: 'metodo_pago' })
  metodoPago: MetodoPago | null;

  @Column({ type: 'varchar', nullable: true, name: 'tarjeta_tipo' })
  tarjetaTipo?: TarjetaTipo | null;

  @Column({ nullable: true, name: 'tarjeta_ultimos4' })
  tarjetaUltimos4?: string | null;

  @Column({ nullable: true, name: 'codigo_autorizacion' })
  codigoAutorizacion?: string | null;

  @Column({ nullable: true, name: 'nombre_entidad' })
  nombreEntidad?: string | null;

  @OneToMany(() => CajaMovimientoDetalle, (d) => d.movimiento, {
    cascade: true,
    eager: false,
  })
  detalles: CajaMovimientoDetalle[];
}

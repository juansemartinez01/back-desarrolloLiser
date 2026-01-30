import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Envase } from './envase.entity';

export enum MovimientoVacioTipo {
  ENTREGA = 'ENTREGA',
  DEVOLUCION = 'DEVOLUCION',
  AJUSTE = 'AJUSTE',
}

@Entity('movimiento_vacio')
@Index(['cliente_id', 'fecha', 'id'])
@Index(['ref_tipo', 'ref_numero'])
@Index(['ref_tipo', 'ref_codigo'])
export class MovimientoVacio {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha: Date;

  @Column({ type: 'uuid' })
  cliente_id: string; // 👈 si es uuid, cambiar a string + type:'uuid'

  @ManyToOne(() => Envase, { eager: false })
  @JoinColumn({ name: 'envase_id' })
  envase: Envase;

  @Column({ type: 'bigint' })
  envase_id: string;

  @Column({
    type: 'enum',
    enum: MovimientoVacioTipo,
    enumName: 'mov_vacio_tipo',
  })
  tipo: MovimientoVacioTipo;

  @Column({ type: 'numeric', precision: 14, scale: 3 })
  cantidad: string;

  @Column({ type: 'numeric', precision: 14, scale: 3 })
  cantidad_firmada: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  precio_unitario_aplicado?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ref_tipo?: string | null; // 'PEDIDO'

  @Column({ type: 'int', nullable: true })
  ref_numero?: number | null; // pedido_id numérico

  @Column({ type: 'varchar', length: 60, nullable: true })
  ref_codigo?: string | null; // "PED-..."

  @Column({ type: 'varchar', length: 300, nullable: true })
  observacion?: string | null;

  @Column({ type: 'int', nullable: true })
  created_by?: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

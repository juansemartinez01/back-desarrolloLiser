import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { CcCliente } from './cliente.entity';

@Entity('cc_cargos')
export class CcCargo extends BaseEntity {
  @Index()
  @Column({ type: 'timestamptz' })
  fecha: Date;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  fecha_vencimiento?: Date | null;

  @ManyToOne(() => CcCliente, { onDelete: 'RESTRICT' })
  cliente: CcCliente;

  @Index()
  @Column({ type: 'uuid' })
  cliente_id: string;

  @Column({ type: 'varchar', length: 30, default: 'VENTA' })
  venta_ref_tipo: string;

  @Column({ type: 'varchar', length: 100 })
  venta_ref_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  importe: string;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;
}

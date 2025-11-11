import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { RemitoItem } from './remito-item.entity';

@Entity('stk_remitos')
export class Remito extends BaseEntity {
  @Index()
  @Column({ type: 'timestamptz' })
  fecha_remito: Date;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  numero_remito: string; // no forzamos unique

  @Index()
  @Column({ type: 'int', nullable: true })
  proveedor_id?: number | null; // id del otro sistema (si lo tenés)

  @Column({ type: 'varchar', length: 200, nullable: true })
  proveedor_nombre?: string | null; // snapshot opcional

  @Column({ type: 'text', nullable: true })
  observaciones?: string | null;

  @Column({ type: 'boolean', default: false })
  es_ingreso_rapido: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  conductor_camion?: string | null;

  @OneToMany(() => RemitoItem, (ri) => ri.remito)
  items: RemitoItem[];
}

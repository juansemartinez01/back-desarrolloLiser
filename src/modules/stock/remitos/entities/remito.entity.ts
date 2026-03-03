// src/modules/stock/remitos/entities/remito.entity.ts
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';
import { RemitoItem } from './remito-item.entity';

@Entity('stk_remitos')
export class Remito extends BaseEntity {
  @Index()
  @Column({ type: 'timestamptz' })
  fecha_remito: Date;

  // ✅ NUEVO: SIEMPRE interno (antes numero_remito)
  @Index()
  @Column({ type: 'varchar', length: 80 })
  codigo_interno: string;

  // ✅ NUEVO: número del papel (externo)
  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  numero_remito_externo?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  numero_remito_externo_norm?: string | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  proveedor_id?: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  proveedor_nombre?: string | null;

  @Column({ type: 'int', nullable: true })
  almacen_id: number;

  @Column({ type: 'text', nullable: true })
  observaciones?: string | null;

  // 👇 nuevos campos
  @Column({ type: 'uuid', nullable: true })
  conductor_camion_id?: string | null;

  @Column({ type: 'boolean', default: false })
  pendiente: boolean;

  @Column({ type: 'boolean', default: false })
  es_ingreso_rapido: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  conductor_camion_nombre?: string | null;

  // ✅ NUEVO: origen del camión (por remito/viaje)
  @Column({ type: 'varchar', length: 200, nullable: true })
  origen_camion_txt?: string | null;

  @OneToMany(() => RemitoItem, (ri) => ri.remito)
  items: RemitoItem[];
}

// src/modules/stock/almacenes/entities/almacen.entity.ts
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';

@Entity('stk_almacenes')
@Index('ix_almacen_nombre', ['nombre'])
@Index('ix_almacen_activo', ['activo'])
export class Almacen extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  direccion?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ciudad?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provincia?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codigo_postal?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  responsable?: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  codigo_interno?: string | null;

  @Column({ type: 'int', nullable: true })
  almacen_id?: number | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}

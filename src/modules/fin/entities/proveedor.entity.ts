import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseAuditEntity } from '../../../entities/base-audit.entity';

@Entity('fin_proveedores')
export class Proveedor extends BaseAuditEntity {
  @PrimaryColumn({ type: 'int' })
  id: number; // alineado con el otro sistema

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cuit?: string | null;

  @Index()
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  external_ref?: string | null;
}

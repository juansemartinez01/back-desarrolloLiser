import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '../../../entities/base-audit.entity';

@Entity('fin_proveedores')
export class Proveedor extends BaseAuditEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number; // ahora autogenerado si no se envía

  @Index()
  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  cuit?: string | null;

  @Index()
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  external_ref?: string | null;

  // NUEVAS COLUMNAS (desde Excel)
  @Column({ type: 'varchar', length: 200, nullable: true })
  domicilio?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  localidad?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cond_iva?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tipo?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  telefonos?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  categoria?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  estado?: string | null;
}

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';

@Entity('cc_clientes')
export class CcCliente extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 200 })
  nombre: string; // razón social / nombre

  @Column({ type: 'varchar', length: 200, nullable: true })
  nombre_fantasia?: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30, nullable: true })
  dni_cuit?: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60, nullable: true })
  externo_codigo?: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  telefono?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Index()
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  tope_deuda_cuenta1: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  tope_deuda_cuenta2: string;
}

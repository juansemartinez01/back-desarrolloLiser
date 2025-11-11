// stk_tipos_producto.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('stk_tipos_producto')
@Index('ix_tipo_prod_nombre', ['nombre'])
@Index('ix_tipo_prod_activo', ['activo'])
export class TipoProducto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 80 })
  nombre: string; // Ej: FRUTA, VERDURA, CONGELADO

  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcion?: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;
}

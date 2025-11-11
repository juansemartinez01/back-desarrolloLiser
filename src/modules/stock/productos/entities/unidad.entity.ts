// stk_unidades.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('stk_unidades')
@Index('ix_unidad_codigo', ['codigo'])
@Index('ix_unidad_activo', ['activo'])
export class Unidad {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  codigo: string; // ej: CAJA_18KG, KG, BANDEJA_1KG

  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcion?: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;
}

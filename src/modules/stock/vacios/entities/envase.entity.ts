import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('envase')
export class Envase {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 80 })
  nombre: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30, nullable: true })
  codigo?: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  precio_base: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

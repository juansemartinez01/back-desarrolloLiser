// src/modules/stock/productos/entities/producto.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stk_productos')
@Index('ix_producto_nombre', ['nombre'])
@Index('ix_producto_activo', ['activo'])
@Index('ux_producto_codigo_comercial', ['codigo_comercial'], { unique: true })
export class Producto {
  @PrimaryGeneratedColumn()
  id: number; // este es el id que hoy usan como producto_id en stock

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  precio_base: string;

  @Column({ type: 'int' })
  unidad_id: number;

  @Column({ type: 'int' })
  tipo_producto_id: number;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ type: 'boolean', default: false })
  vacio: boolean;

  @Column({ type: 'boolean', default: false })
  oferta: boolean;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  precio_oferta: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  imagen?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  precio_vacio: string;

  @Column({ type: 'int', nullable: true })
  id_interno?: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  empresa?: string | null;

  // NUEVO: código comercial único (por negocio)
  @Column({ type: 'varchar', length: 120, nullable: true })
  codigo_comercial?: string | null;

  @Column({
    type: 'timestamptz',
    default: () => 'now()',
  })
  created_at: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'now()',
  })
  updated_at: Date;
}

// src/modules/stock/productos/entities/producto.entity.ts
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Unidad } from './unidad.entity';
import { TipoProducto } from './tipo-producto.entity';

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

  @Column({ type: 'varchar', length: 100, nullable: true })
  id_interno?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  empresa?: string | null;

  // NUEVO: código comercial único (por negocio)
  @Column({ type: 'varchar', length: 120, nullable: true })
  codigo_comercial?: string | null;

  /** -------------------------
   *  NUEVOS CAMPOS ADMINISTRATIVOS
   *  ------------------------- */

  // IVA
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 21 })
  alicuota_iva: string;

  @Column({ type: 'boolean', default: false })
  exento_iva: boolean;

  // Precios administrativos
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  precio_compra: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  precio_sin_iva: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  precio_con_iva: string;

  // Selector fiscal (1 Venta Propia / 2 Liquidación / 3 Importación...)
  @Column({ type: 'int', default: 1 })
  selector_fiscal: number;

  // Categoría fiscal visible en la planilla (C, Z, N…)
  @Column({ type: 'varchar', length: 5, nullable: true })
  categoria_fiscal?: string | null;

  // Permite que un producto sea o no facturable
  @Column({ type: 'boolean', default: true })
  facturable: boolean;

  /*-------------------------*/

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

  @ManyToOne(() => Unidad, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @ManyToOne(() => TipoProducto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tipo_producto_id' })
  tipo: TipoProducto;

  @Index('ix_producto_proveedor')
  @Column({ type: 'int', nullable: true })
  proveedor_id?: number | null;
}

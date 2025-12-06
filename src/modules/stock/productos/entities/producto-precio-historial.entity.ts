// src/modules/stock/productos/entities/producto-precio-historial.entity.ts

import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('stk_productos_precios_historial')
export class ProductoPrecioHistorial {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 120 })
  codigo_comercial: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  precio_compra: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  precio_sin_iva: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  precio_con_iva: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  alicuota_iva: string;

  @Column({ type: 'boolean' })
  exento_iva: boolean;

  @Column({ type: 'int' })
  selector_fiscal: number;

  @Column({
    type: 'timestamptz',
    default: () => 'now()',
  })
  fecha_cambio: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  usuario?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  motivo?: string | null;
}

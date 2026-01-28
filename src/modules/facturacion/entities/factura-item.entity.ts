import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Factura } from './factura.entity';

@Entity('fac_facturas_items')
export class FacturaItem extends BaseEntity {
  @ManyToOne(() => Factura, (f) => f.items, { onDelete: 'CASCADE' })
  factura: Factura;

  @Index()
  @Column({ type: 'uuid' })
  factura_id: string;

  @Column({ type: 'int', nullable: true, name: 'codigo' })
  Codigo?: number | null;

  @Index()
  @Column({ type: 'int', nullable: true, name: 'producto_id' })
  ProductoId?: number | null;

  @Column({ type: 'varchar', length: 300, nullable: true, name: 'producto' })
  Producto?: string | null;

  @Column({ type: 'int', default: 5, name: 'alicuota_iva' })
  AlicuotaIVA: number;

  @Column({ type: 'boolean', default: false, name: 'exento' })
  Exento: boolean;

  @Column({ type: 'boolean', default: true, name: 'consignacion' })
  Consignacion: boolean;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 1,
    name: 'cantidad',
  })
  Cantidad: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
    nullable: true,
    name: 'precio_unitario_total',
  })
  Precio_Unitario_Total?: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
    nullable: true,
    name: 'precio_unitario_neto',
  })
  Precio_Unitario_Neto?: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
    nullable: true,
    name: 'iva_unitario',
  })
  IVA_Unitario?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  total_neto: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  total_iva: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  total_con_iva: string;
}


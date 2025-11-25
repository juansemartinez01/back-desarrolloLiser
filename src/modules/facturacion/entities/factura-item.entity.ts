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

  // Copiamos los campos que manda el payload
  @Column({ type: 'int', nullable: true })
  Codigo?: number | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  Producto?: string | null;

  @Column({ type: 'int', default: 5 })
  AlicuotaIVA: number;

  @Column({ type: 'boolean', default: false })
  Exento: boolean;

  @Column({ type: 'boolean', default: true })
  Consignacion: boolean;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  Cantidad: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  Precio_Unitario_Total?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  Precio_Unitario_Neto?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  IVA_Unitario?: string | null;

  // Totales calculados para auditoría
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  total_neto: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  total_iva: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  total_con_iva: string;
}

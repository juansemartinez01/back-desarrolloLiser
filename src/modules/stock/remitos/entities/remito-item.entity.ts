import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, RelationId } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';
import { Remito } from './remito.entity';
import { EmpresaFactura } from '../../enums/empresa-factura.enum';
import { StockLote } from '../../stock-actual/entities/stock-lote.entity';

@Entity('stk_remito_items')
export class RemitoItem extends BaseEntity {
  @ManyToOne(() => Remito, (r) => r.items, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'remito_id' })
  remito: Remito;

  @RelationId((ri: RemitoItem) => ri.remito)
  remito_id: string;

  @Index()
  @Column({ type: 'int' })
  producto_id: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unidad?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_total: string; // cantidad física real

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  cantidad_remito?: string | null; // cantidad declarada en el papel

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_tipo1: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_tipo2: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  empresa_factura: EmpresaFactura;

  // Campos crudos del Operario A
  @Column({ type: 'varchar', length: 200, nullable: true })
  nombre_capturado?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  presentacion_txt?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  tamano_txt?: string | null;

  @Column({ type: 'text', nullable: true })
  nota_operario_a?: string | null;

  @OneToMany(() => StockLote, (l) => l.remito_item)
  lotes: StockLote[];
}


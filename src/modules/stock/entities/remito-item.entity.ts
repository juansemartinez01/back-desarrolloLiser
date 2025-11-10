import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, RelationId } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Remito } from './remito.entity';
import { EmpresaFactura } from '../enums/empresa-factura.enum';
import { StockLote } from './stock-lote.entity';

@Entity('stk_remito_items')
export class RemitoItem extends BaseEntity {
  @ManyToOne(() => Remito, (r) => r.items, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'remito_id' }) // 👈 nombre real de la FK
  remito: Remito;

  @RelationId((ri: RemitoItem) => ri.remito) // 👈 opcional, para tener el id sin duplicar la columna
  remito_id: string;

  @Index()
  @Column({ type: 'int' })
  producto_id: number; // referencia a productos del otro sistema

  @Column({ type: 'varchar', length: 50, nullable: true })
  unidad?: string | null; // snapshot opcional

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_total: string; // numeric en TypeORM como string

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_tipo1: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_tipo2: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  empresa_factura: EmpresaFactura; // 'GLADIER' | 'SAYRUS'

  // Regla: cantidad_blanco + cantidad_negro = cantidad_total (CHECK en migración)

  @OneToMany(() => StockLote, (l) => l.remito_item)
  lotes: StockLote[];
}

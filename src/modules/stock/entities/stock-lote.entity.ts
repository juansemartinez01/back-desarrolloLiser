import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, RelationId } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { RemitoItem } from './remito-item.entity';
import { LoteAlmacen } from './lote-almacen.entity';
import { LoteTipo } from '../enums/lote-tipo.enum';

@Entity('stk_lotes')
export class StockLote extends BaseEntity {
  @ManyToOne(() => RemitoItem, (ri) => ri.lotes, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'remito_item_id' }) // 👈 nombre real de la FK
  remito_item: RemitoItem;

  @RelationId((l: StockLote) => l.remito_item) // 👈 opcional, para leer el id
  remito_item_id: string;

  @Index()
  @Column({ type: 'int' })
  producto_id: number; // denormalizado para consultas rápidas

  @Index()
  @Column({ type: 'timestamptz' })
  fecha_remito: Date; // denormalizado para FIFO

  @Index()
  @Column({
    type: 'smallint',
    name: 'lote_tipo',
    comment: '1 o 2',
  })
  lote_tipo: LoteTipo; // o number (1|2)

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_inicial: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_disponible: string; // disponible global (no por almacén)

  @OneToMany(() => LoteAlmacen, (la) => la.lote)
  en_almacenes: LoteAlmacen[];

  @Column({ type: 'boolean', default: false })
  bloqueado: boolean;
}

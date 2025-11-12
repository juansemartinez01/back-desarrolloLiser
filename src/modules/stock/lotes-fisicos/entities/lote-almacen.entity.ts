// src/stock/entities/lote-almacen.entity.ts
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  RelationId,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { StockLote } from '../stock-actual/entities/stock-lote.entity';

@Entity('stk_lote_almacen')
@Unique('ux_lote_almacen', ['lote', 'almacen_id']) // 👈 referencia a la PROPIEDAD, no al nombre de columna
export class LoteAlmacen extends BaseEntity {
  @ManyToOne(() => StockLote, (l) => l.en_almacenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lote_id' }) // 👈 mapea a la columna real
  lote: StockLote;

  @RelationId((la: LoteAlmacen) => la.lote)
  readonly lote_id: string; // 👈 solo lectura; NO @Column

  @Index()
  @Column({ name: 'almacen_id', type: 'int' })
  almacen_id: number;

  @Column({
    name: 'cantidad_asignada',
    type: 'numeric',
    precision: 18,
    scale: 4,
    default: () => '0',
  })
  cantidad_asignada: string;

  @Column({
    name: 'cantidad_disponible',
    type: 'numeric',
    precision: 18,
    scale: 4,
    default: () => '0',
  })
  cantidad_disponible: string;
}

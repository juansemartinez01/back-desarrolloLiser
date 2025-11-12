// src/modules/stock/entities/lote-contable.entity.ts
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  RelationId,
} from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';
import { StockLote } from '../../stock-actual/entities/stock-lote.entity';
import { EmpresaFactura } from '../../enums/empresa-factura.enum';
import { LoteContableEstado } from '../../enums/lote-contable-estado.enum';

@Entity('stk_lotes_contables')
export class LoteContable extends BaseEntity {
  @ManyToOne(() => StockLote, (l) => l.contable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lote_id' })
  lote: StockLote;

  @RelationId((lc: LoteContable) => lc.lote)
  @Index()
  @Column({ type: 'uuid' })
  lote_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_total: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_tipo1: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_tipo2: string;

  // cuánto del lote contable ya se imputó como vendido
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  cantidad_vendida: string;

  @Column({ type: 'varchar', length: 20 })
  empresa_factura: EmpresaFactura;

  @Column({
    type: 'varchar',
    length: 20,
    default: LoteContableEstado.SIN_VENDER,
  })
  estado: LoteContableEstado;

  
}

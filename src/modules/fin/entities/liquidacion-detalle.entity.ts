import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Liquidacion } from './liquidacion.entity';

@Entity('fin_liquidacion_det')
export class LiquidacionDetalle extends BaseEntity {
  @ManyToOne(() => Liquidacion, (l) => l.detalles, { onDelete: 'CASCADE' })
  liquidacion: Liquidacion;

  @Index()
  @Column({ type: 'uuid' })
  remito_id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  remito_item_id?: string | null;

  @Index()
  @Column({ type: 'int' })
  producto_id: number;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  cantidad_base: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  monto_pago: string;

  @Column({ type: 'text', nullable: true })
  notas?: string | null;
}

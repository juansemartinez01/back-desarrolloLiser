import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Pago } from './pago.entity';

@Entity('fin_pago_aplic')
export class PagoAplic extends BaseEntity {
  @ManyToOne(() => Pago, (p) => p.aplicaciones, { onDelete: 'CASCADE' })
  pago: Pago;

  @Index() @Column({ type: 'uuid' }) liquidacion_id: string;
  @Column({ type: 'numeric', precision: 18, scale: 4 }) monto_aplicado: string;
}

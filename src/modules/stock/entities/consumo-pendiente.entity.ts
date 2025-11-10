import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';

@Entity('stk_consumos_pendientes')
export class ConsumoPendiente extends BaseEntity {
  @Index()
  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha: Date;

  @Index()
  @Column({ type: 'int' })
  producto_id: number;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_pendiente: string; // > 0; se compensará con futuros remitos

  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia_venta_id?: string | null; // id externo del pedido

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  precio_unitario?: string | null; // opcional, para futuros reportes

  @Column({ type: 'text', nullable: true })
  notas?: string | null;
}

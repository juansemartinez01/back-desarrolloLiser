import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';

@Entity('stk_transferencias_pendientes')
export class TransferenciaPendiente extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  movimiento_id: string; // Movimiento original generado en TRANSFERENCIA

  @Index()
  @Column({ type: 'int' })
  almacen_destino_id: number;

  @Index()
  @Column({ type: 'int' })
  producto_id: number;

  @Index()
  @Column({ type: 'uuid' })
  lote_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad_enviada: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  cantidad_recibida?: string | null;

  @Column({ type: 'boolean', default: false })
  completado: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_recepcion?: Date | null;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;
}

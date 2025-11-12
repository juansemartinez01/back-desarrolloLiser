import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';
import { MovimientoStock } from './movimiento-stock.entity';

@Entity('stk_movimientos_det')
export class MovimientoStockDetalle extends BaseEntity {
  @ManyToOne(() => MovimientoStock, (m) => m.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movimiento_id' }) // 👈 nombre REAL de la FK en la tabla
  movimiento: MovimientoStock;

  @Index()
  @Column({ type: 'int' })
  producto_id: number;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  lote_id?: string | null; // null si aún no se pudo asignar (venta sin lote)

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  cantidad: string; // siempre positiva

  @Column({ type: 'smallint' })
  efecto: number; // +1 = entrada; -1 = salida
}

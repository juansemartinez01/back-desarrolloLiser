import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';
import { MovimientoTipo } from '../../enums/movimiento-tipo.enum';
import { MovimientoStockDetalle } from './movimiento-stock-detalle.entity';

@Entity('stk_movimientos')
export class MovimientoStock extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 20 })
  tipo: MovimientoTipo; // INGRESO | TRANSFERENCIA | VENTA | MERMA | AJUSTE

  @Index()
  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha: Date;

  @Index()
  @Column({ type: 'int', nullable: true })
  almacen_origen_id?: number | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  almacen_destino_id?: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  referencia_tipo?: string | null; // ej: 'REM'; 'VENTA'

  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia_id?: string | null; // id externo del doc

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;

  @OneToMany(() => MovimientoStockDetalle, (d) => d.movimiento)
  detalles: MovimientoStockDetalle[];
}

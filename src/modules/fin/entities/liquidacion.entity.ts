import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { LiquidacionEstado } from '../enums/liquidacion-estado.enum';
import { LiquidacionDetalle } from './liquidacion-detalle.entity';

@Entity('fin_liquidaciones')
export class Liquidacion extends BaseEntity {
  @Index()
  @Column({ type: 'int' })
  proveedor_id: number;

  @Index()
  @Column({ type: 'timestamptz' })
  fecha: Date;

  @Index()
  @Column({ type: 'varchar', length: 20, default: LiquidacionEstado.BORRADOR })
  estado: LiquidacionEstado;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  total_monto: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  referencia_externa?: string | null;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;

  @OneToMany(() => LiquidacionDetalle, (d) => d.liquidacion)
  detalles: LiquidacionDetalle[];
}

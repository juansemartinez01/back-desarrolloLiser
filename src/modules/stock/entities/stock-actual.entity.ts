import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('stk_stock_actual')
@Unique('ux_stock_actual_prod_alm', ['producto_id', 'almacen_id'])
export class StockActual {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  producto_id: number;

  @Index()
  @Column({ type: 'int' })
  almacen_id: number;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  cantidad: string;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('stk_stock_reservado')
export class ReservaStock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  producto_id: number;

  @Column({ type: 'int' })
  almacen_id: number;

  @Column({ type: 'numeric', precision: 14, scale: 4 })
  cantidad_reservada: string;

  @Column({ type: 'varchar', nullable: true })
  lote_id: string | null;

  @Column({ type: 'int', nullable: true })
  pedido_id: number | null; // para relacionarlo a un carrito / orden pendiente

  @Column({
    type: 'varchar',
    default: 'RESERVADO',
  })
  estado: 'RESERVADO' | 'CANCELADO' | 'CONSUMIDO';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

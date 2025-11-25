// src/modules/facturacion/entities/catalogos.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fac_moneda')
export class FacMoneda {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 3, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 60 })
  nombre: string;
}

@Entity('fac_metodo_pago')
export class FacMetodoPago {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 60 })
  nombre: string;
}

@Entity('fac_tipo_cbte')
export class FacTipoCbte {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  descripcion: string;
}

@Entity('fac_aliquota_iva')
export class FacAliquotaIva {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  descripcion: string;
}

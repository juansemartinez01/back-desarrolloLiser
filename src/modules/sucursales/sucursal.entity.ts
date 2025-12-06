// src/sucursales/sucursal.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { CajaApertura } from '../caja/entities/caja-apertura.entity';

@Entity('sucursal')
export class Sucursal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  direccion: string;

  @OneToMany(() => CajaApertura, (apertura) => apertura.sucursal)
  aperturas: CajaApertura[];
}

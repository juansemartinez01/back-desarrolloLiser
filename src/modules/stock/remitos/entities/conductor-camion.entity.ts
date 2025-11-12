// src/modules/stock/remitos/entities/conductor-camion.entity.ts
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';

@Entity('stk_conductores_camion')
export class ConductorCamion extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}

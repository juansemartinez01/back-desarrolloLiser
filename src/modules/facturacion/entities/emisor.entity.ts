// src/modules/facturacion/entities/emisor.entity.ts
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';

@Entity('fac_emisores')
export class FacEmisor extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  razon_social: string;

  @Index()
  @Column({ type: 'bigint' })
  cuit_computador: number;

  @Index()
  @Column({ type: 'bigint', nullable: true })
  cuit_representado?: number | null;

  @Column({ type: 'boolean', default: true })
  test: boolean;

  @Column({ type: 'text' })
  cert_content: string;

  @Column({ type: 'text' })
  key_content: string;

  @Index()
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;
}

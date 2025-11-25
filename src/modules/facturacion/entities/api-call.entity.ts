// src/modules/facturacion/entities/api-call.entity.ts
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';

@Entity('fac_api_calls')
export class FacApiCall extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', nullable: true })
  emisor_id?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  endpoint: '/certificados' | '/facturas' | '/liquidaciones' | '/compras';

  @Column({ type: 'jsonb', nullable: true })
  request_payload?: any | null;

  @Column({ type: 'jsonb', nullable: true })
  response_payload?: any | null;

  @Column({ type: 'int', nullable: true })
  status_http?: number | null;

  @Index()
  @Column({ type: 'boolean', nullable: true })
  ok?: boolean | null;

  @Column({ type: 'text', nullable: true })
  error_msg?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  documento_tipo?: 'FACTURA' | 'LIQ' | 'COMPRA' | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  documento_id?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  idempotency_key?: string | null;
}

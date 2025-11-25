// src/modules/facturacion/entities/compra.entity.ts
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';

@Entity('fac_compras')
export class FacCompra extends BaseEntity {
  @Index()
  @Column({ type: 'date' })
  fecha_emision: string;

  @Column({ type: 'int' })
  comprobante_tipo: number;

  @Column({ type: 'int', default: 1 })
  punto_venta: number;

  @Column({ type: 'int' })
  nro_comprobante: number;

  @Column({ type: 'bigint', nullable: true })
  cae?: number | null;

  @Column({ type: 'int' })
  clasificacion: number; // 1/2/3

  @Column({ type: 'int' })
  doc_tipo_vendedor: number;

  @Column({ type: 'bigint' })
  doc_nro_vendedor: number;

  @Column({ type: 'varchar', length: 200 })
  nombre_vendedor: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  despacho_importacion?: string | null;

  // Totales
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  importe_total: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  importe_no_gravado: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  importe_exento: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  percep_iva: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  percep_otros_nac: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  percep_iibb: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  percep_municipales: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  impuestos_internos: string;

  // IVA
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_0: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_025: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_025: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_05: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_05: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_105: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_105: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_21: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_21: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_27: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_27: string;

  @Column({ type: 'varchar', length: 3, default: 'PES' })
  moneda: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  cotizacion: string;

  @Column({ type: 'varchar', length: 5, default: ' ' })
  codigo_operacion_exento: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  credito_fiscal_computable: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  otros_tributos: string;

  @Column({ type: 'boolean', default: false })
  intermediacion_tercero: boolean;

  @Column({ type: 'bigint', nullable: true })
  cuit_emisor_corredor?: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  denom_emisor_corredor?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_comision: string;

  // NC/ND recibida
  @Column({ type: 'int', nullable: true })
  tipo_cbte_orig?: number | null;

  @Column({ type: 'int', nullable: true })
  pto_vta_orig?: number | null;

  @Column({ type: 'int', nullable: true })
  nro_cbte_orig?: number | null;

  // Calculados
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  importe_neto: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  importe_iva: string;

  @Column({ type: 'int', default: 0 })
  cant_alicuotas: number;

  // TXT
  @Column({ type: 'text', nullable: true })
  txt_compras?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  txt_alicuotas_compras?: any | null;

  @Column({ type: 'jsonb', nullable: true })
  txt_importacion_compras?: any | null;

  @Index()
  @Column({ type: 'varchar', length: 15, default: 'REGISTERED' })
  estado: 'REGISTERED' | 'ERROR';

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  idempotency_key?: string | null;
}

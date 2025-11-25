import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { FacturaItem } from './factura-item.entity';

@Entity('fac_facturas')
export class Factura extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  emisor_id: string; // FK lógica a fac_emisores.id

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia_interna?: string | null; // id pedido o similar

  // Receptor
  @Column({ type: 'varchar', length: 200, nullable: true })
  razon_social_receptor?: string | null;

  @Column({ type: 'int', default: 99 })
  doc_tipo: number; // 99 CF

  @Column({ type: 'bigint', default: 0 })
  doc_nro: number;

  @Column({ type: 'int', default: 5 })
  cond_iva_receptor: number;

  // Comprobante
  @Index()
  @Column({ type: 'int', default: 11 })
  factura_tipo: number; // 11=C, 1=A, 6=B etc

  @Index()
  @Column({ type: 'int', default: 1 })
  punto_venta: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  nro_comprobante?: number | null;

  @Column({ type: 'int', default: 1 })
  concepto: number; // 1 productos

  // Moneda
  @Column({ type: 'varchar', length: 3, default: 'PES' })
  moneda: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  cotizacion: string;

  // Importes
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  importe_total: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  importe_neto: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  importe_iva: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  importe_no_gravado: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  importe_exento: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  importe_tributos: string;

  // Bases para IIBB (opcional)
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  Neto_Consignacion: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  Neto_VentaPropia: string;

  // NC/ND referencia
  @Column({ type: 'int', nullable: true })
  tipo_comprobante_original?: number | null;

  @Column({ type: 'int', nullable: true })
  pto_venta_original?: number | null;

  @Column({ type: 'int', nullable: true })
  nro_comprobante_original?: number | null;

  @Column({ type: 'bigint', nullable: true })
  cuit_receptor_comprobante_original?: number | null;

  // Estado emisión
  @Index()
  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estado: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'ERROR';

  // Respuesta AFIP/externo
  @Column({ type: 'varchar', length: 50, nullable: true })
  cae?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cae_vencimiento?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_emision?: Date | null;

  @Column({ type: 'text', nullable: true })
  qr_url?: string | null;

  @Column({ type: 'text', nullable: true })
  txt_venta?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  txt_alicuotas_venta?: string[] | null;

  // Tracking errores
  @Column({ type: 'text', nullable: true })
  error_msj?: string | null;

  @OneToMany(() => FacturaItem, (i) => i.factura)
  items: FacturaItem[];
}

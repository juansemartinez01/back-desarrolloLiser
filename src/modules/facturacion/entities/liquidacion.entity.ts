// src/modules/facturacion/entities/liquidacion.entity.ts
import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { FacEmisor } from './emisor.entity';

@Entity('fac_liquidaciones')
export class FacLiquidacion extends BaseEntity {
  @ManyToOne(() => FacEmisor, { onDelete: 'RESTRICT' })
  emisor: FacEmisor;

  @Index()
  @Column({ type: 'uuid' })
  emisor_id: string;

  @Column({ type: 'boolean', default: true })
  electronica: boolean;

  @Column({ type: 'text', nullable: true })
  token?: string | null;

  @Column({ type: 'text', nullable: true })
  sign?: string | null;

  @Column({ type: 'int', nullable: true })
  comprobante_nro?: number | null;

  @Column({ type: 'int', default: 63 })
  factura_tipo: number;

  @Column({ type: 'int', default: 1 })
  punto_venta: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  nro_comprobante?: number | null;

  @Column({ type: 'int', nullable: true })
  metodo_pago?: number | null;

  @Column({ type: 'int', default: 3 })
  concepto: number;

  @Column({ type: 'int', nullable: true })
  nro_remito?: number | null;

  @Column({ type: 'date', nullable: true })
  fecha_liquidacion?: string | null;

  @Column({ type: 'date', nullable: true })
  fecha_inicio_servicios?: string | null;

  @Column({ type: 'date', nullable: true })
  fecha_fin_servicios?: string | null;

  @Column({ type: 'date', nullable: true })
  fecha_vto_pago?: string | null;

  @Column({ type: 'varchar', length: 3, default: 'PES' })
  moneda: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  cotizacion: string;

  @Column({ type: 'char', length: 1, default: 'N' })
  moneda_pago: string;

  // Receptor
  @Column({ type: 'varchar', length: 200 })
  razon_social_receptor: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  domicilio_receptor?: string | null;

  @Column({ type: 'int' })
  doc_tipo: number;

  @Column({ type: 'bigint' })
  doc_nro: number;

  @Column({ type: 'int' })
  cond_iva_receptor: number;

  // Comisión
  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0.12 })
  porcentaje_comision: string;

  // Totales
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  liquidacion_neto: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  liquidacion_iva: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  liquidacion_total: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  comision_neto: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  comision_iva: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  comision_total: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  final_liquidar: string;

  // IVA liquidar
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_0_liquidar: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_025_liquidar: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_025_liquidar: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_05_liquidar: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_05_liquidar: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_105_liquidar: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_105_liquidar: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_21_liquidar: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_21_liquidar: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_27_liquidar: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_27_liquidar: string;

  // IVA comisión
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_0_comision: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_025_comision: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_025_comision: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_05_comision: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_05_comision: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_105_comision: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_105_comision: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_21_comision: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_21_comision: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  neto_27_comision: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  iva_27_comision: string;

  // Respuestas AFIP
  @Column({ type: 'varchar', length: 20, nullable: true })
  cae?: string | null;

  @Column({ type: 'date', nullable: true })
  vencimiento?: string | null;

  @Column({ type: 'text', nullable: true })
  qr_url?: string | null;

  // TXT
  @Column({ type: 'text', nullable: true })
  txt_venta?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  txt_alicuotas_venta?: any | null;

  @Column({ type: 'text', nullable: true })
  txt_compra?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  txt_alicuotas_compra?: any | null;

  @Index()
  @Column({ type: 'varchar', length: 15, default: 'DRAFT' })
  estado: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'ERROR';

  @Column({ type: 'uuid', nullable: true })
  cargo_id?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  idempotency_key?: string | null;

  @OneToMany(() => FacLiquidacionItem, (i) => i.liquidacion)
  items: FacLiquidacionItem[];
}

@Entity('fac_liquidacion_items')
export class FacLiquidacionItem extends BaseEntity {
  @ManyToOne(() => FacLiquidacion, (l) => l.items, { onDelete: 'CASCADE' })
  liquidacion: FacLiquidacion;

  @Index()
  @Column({ type: 'uuid' })
  liquidacion_id: string;

  @Column({ type: 'int', nullable: true })
  codigo?: number | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcion?: string | null;

  @Column({ type: 'int' })
  alicuota_iva: number;

  @Column({ type: 'boolean', default: false })
  exento: boolean;

  @Column({ type: 'boolean', default: true })
  consignacion: boolean;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 1 })
  cantidad: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  pu_total?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  pu_neto?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  iva_unit?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  importe_neto?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  importe_iva?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  importe_total?: string | null;
}

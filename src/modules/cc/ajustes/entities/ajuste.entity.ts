import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../entities/base.entity';
import { CcCliente } from '../../entities/cliente.entity';
import { AjusteTipo } from '../../enums/ajuste-tipo.enum';

@Entity('cc_ajustes')
export class CcAjuste extends BaseEntity {
  @Index()
  @Column({ type: 'timestamptz' })
  fecha: Date;

  @ManyToOne(() => CcCliente, { onDelete: 'RESTRICT' })
  cliente: CcCliente;

  @Index()
  @Column({ type: 'uuid' })
  cliente_id: string;

  @Index()
  @Column({ type: 'enum', enum: AjusteTipo, enumName: 'cc_ajuste_tipo' })
  tipo: AjusteTipo; // DEBITO suma deuda, CREDITO resta deuda

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  importe: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia_externa?: string | null;

  @Column({ type: 'text', nullable: true })
  observacion?: string | null;
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateLiquidacionDto } from './dto/create-liquidacion.dto';
import { QueryLiquidacionesDto } from './dto/query-liquidaciones.dto';
import { FactuExternalClient } from '../http/factu-external.client';
import { ApiLoggerService } from '../services/api-logger.service';

type Bucket = '0' | '025' | '05' | '105' | '21' | '27';

function toFixed4(n: number) {
  return Number(n.toFixed(4));
}

function alicuotaToBucket(code: number): Bucket {
  // 3: 0% | 4: 10.5%? (depende tabla AFIP de tu backend externo)
  // Tomamos convención usada en FacturaOut:
  switch (code) {
    case 3:
      return '0';
    case 4:
      return '05'; // si tu backend externo mapea 4->5% o 10.5% ajustalo aquí
    case 5:
      return '105';
    case 6:
      return '21';
    case 8:
      return '27';
    // si usás 0.25% => '025'
    default:
      return '21';
  }
}

@Injectable()
export class LiquidacionesService {
  constructor(
    private readonly ds: DataSource,
    private readonly http: FactuExternalClient,
    private readonly logger: any,
  ) {}

  // ---------------- Helpers de cálculo ----------------
  private _normalizeItems(lista: CreateLiquidacionDto['lista_productos']) {
    // Asegura (Neto, IVA, Total) por ítem.
    // Si viene Precio_Unitario_Total => derivamos Neto/IVA según alícuota.
    // Si viene Neto => derivamos Total/IVA.
    // Si Exento => IVA = 0, Bucket '0'.
    return lista.map((it) => {
      const alic = it.Exento ? 3 : it.AlicuotaIVA;
      const qty = Number(it.Cantidad);
      let unitNet = it.Precio_Unitario_Neto ?? null;
      let unitTot = it.Precio_Unitario_Total ?? null;
      let unitIva = it.IVA_Unitario ?? null;

      const rate =
        alic === 3
          ? 0
          : alic === 4
            ? 0.1 // ajusta si en tu backend 4 es 5% u otra
            : alic === 5
              ? 0.105
              : alic === 6
                ? 0.21
                : alic === 8
                  ? 0.27
                  : 0.21;

      if (unitTot == null && unitNet == null) {
        throw new BadRequestException(
          'Cada ítem debe tener Precio_Unitario_Total o Precio_Unitario_Neto',
        );
      }

      if (unitTot != null && unitNet == null) {
        unitNet = rate === 0 ? unitTot : unitTot / (1 + rate);
        unitIva = unitTot - unitNet;
      } else if (unitNet != null && unitTot == null) {
        unitIva = unitNet * rate;
        unitTot = unitNet + unitIva;
      } else if (unitNet != null && unitTot != null) {
        unitIva = unitTot - unitNet;
      }

      return {
        ...it,
        AlicuotaIVA: alic,
        Cantidad: qty,
        _unitNet: toFixed4(unitNet!),
        _unitIva: toFixed4(unitIva!),
        _unitTot: toFixed4(unitTot!),
        _neto: toFixed4(unitNet! * qty),
        _iva: toFixed4(unitIva! * qty),
        _total: toFixed4(unitTot! * qty),
        _bucket: alicuotaToBucket(alic),
      };
    });
  }

  private _sumBuckets(
    items: ReturnType<LiquidacionesService['_normalizeItems']>,
  ) {
    const b = {
      '0': 0,
      '025': 0,
      '05': 0,
      '105': 0,
      '21': 0,
      '27': 0,
    } as Record<Bucket, number>;
    const bIVA = { '025': 0, '05': 0, '105': 0, '21': 0, '27': 0 } as Record<
      Exclude<Bucket, '0'>,
      number
    >;

    for (const it of items) {
      b[it._bucket] += it._neto;
      if (it._bucket !== '0') (bIVA as any)[it._bucket] += it._iva;
    }
    return {
      Neto_0: toFixed4(b['0']),
      Neto_025: toFixed4(b['025']),
      IVA_025: toFixed4(bIVA['025'] || 0),
      Neto_05: toFixed4(b['05']),
      IVA_05: toFixed4(bIVA['05'] || 0),
      Neto_105: toFixed4(b['105']),
      IVA_105: toFixed4(bIVA['105']),
      Neto_21: toFixed4(b['21']),
      IVA_21: toFixed4(bIVA['21']),
      Neto_27: toFixed4(b['27']),
      IVA_27: toFixed4(bIVA['27']),
    };
  }

  private _calcComision(
    items: ReturnType<LiquidacionesService['_normalizeItems']>,
    porcentaje: number,
  ) {
    // Comisión sobre el neto (venta propia vs consignación: por ahora sumamos ambos
    // y dejamos campo Neto_Consignacion/Neto_VentaPropia si lo querés separar luego)
    let netoBase = 0;
    let netoCons = 0;
    let netoProp = 0;

    for (const it of items) {
      netoBase += it._neto;
      if (it.Consignacion) netoCons += it._neto;
      else netoProp += it._neto;
    }
    const comNet = toFixed4(netoBase * porcentaje);
    // Asumimos IVA comision 21% (ajustá si tu negocio usa otra alícuota)
    const comIva = toFixed4(comNet * 0.21);
    const comTot = toFixed4(comNet + comIva);
    return { comNet, comIva, comTot, netoCons, netoProp };
  }

  private _todayYYYYMMDD() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    return Number(`${yyyy}${mm}${dd}`);
  }

  // ---------------- Core: crear y emitir ----------------
  async crearYEmitir(dto: CreateLiquidacionDto) {
    // 0) Emisor existe?
    const em = await this.ds.query(
      `SELECT id FROM public.fac_emisores WHERE id = $1`,
      [dto.emisor_id],
    );
    if (!em?.length) throw new BadRequestException('Emisor inexistente');

    // 1) Normalizar ítems y calcular totales
    const items = this._normalizeItems(dto.lista_productos);
    const buckets = this._sumBuckets(items);

    const importe_neto = toFixed4(
      buckets.Neto_0 +
        buckets.Neto_025 +
        buckets.Neto_05 +
        buckets.Neto_105 +
        buckets.Neto_21 +
        buckets.Neto_27,
    );
    const importe_iva = toFixed4(
      buckets.IVA_025 +
        buckets.IVA_05 +
        buckets.IVA_105 +
        buckets.IVA_21 +
        buckets.IVA_27,
    );
    const importe_total = toFixed4(importe_neto + importe_iva);

    const { comNet, comIva, comTot, netoCons, netoProp } = this._calcComision(
      items,
      dto.porcentaje_comision,
    );
    const final_liquidar = toFixed4(importe_total - comTot);

    const electronica = !!dto.electronica;
    const factura_tipo = dto.factura_tipo ?? 63; // A por default si no viene
    const punto_venta = dto.punto_venta ?? 1;
    const referencia_interna =
      dto.referencia_interna ??
      `LIQ:${dto.emisor_id}:${electronica ? 'E' : 'M'}:${punto_venta}:${factura_tipo}:${this._todayYYYYMMDD()}`;

    // 2) Idempotencia: si ya existe por (emisor_id, referencia_interna) devolver detalle
    const idem = await this.ds.query(
      `SELECT id FROM public.fac_liquidaciones WHERE emisor_id = $1 AND referencia_interna = $2 LIMIT 1`,
      [dto.emisor_id, referencia_interna],
    );
    if (idem?.length) {
      const id = idem[0].id;
      return this.detalle(id); // devuelve lo persistido
    }

    // 3) Persistir + llamar API externa dentro de TX
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 3.1 Insert encabezado (estado PENDIENTE)
      const [liq] = await qr.query(
        `INSERT INTO public.fac_liquidaciones
           (emisor_id, referencia_interna, electronica, factura_tipo, punto_venta,
            metodo_pago, concepto, nro_remito, fecha_liquidacion, fecha_inicio_servicios,
            fecha_fin_servicios, fecha_vto_pago, moneda, cotizacion, moneda_pago,
            razon_social_receptor, domicilio_receptor, doc_tipo, doc_nro, cond_iva_receptor,
            porcentaje_comision,
            neto_consignacion, neto_venta_propia,
            importe_neto, importe_iva, importe_total,
            comision_neto, comision_iva, comision_total,
            final_liquidar,
            neto_0, neto_025, iva_025, neto_05, iva_05, neto_105, iva_105, neto_21, iva_21, neto_27, iva_27,
            codigo_operacion_exento,
            estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                 $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
                 $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,
                 $42,'PENDIENTE')
         RETURNING *`,
        [
          dto.emisor_id,
          referencia_interna,
          electronica,
          factura_tipo,
          punto_venta,
          dto.metodo_pago ?? null,
          dto.concepto ?? 3,
          dto.nro_remito ?? null,
          dto.fecha_liquidacion ?? this._todayYYYYMMDD(),
          dto.fecha_inicio_servicios ?? null,
          dto.fecha_fin_servicios ?? null,
          dto.fecha_vto_pago ?? null,
          dto.moneda ?? 'PES',
          dto.cotizacion ?? 1.0,
          dto.moneda_pago ?? 'N',

          dto.razon_social_receptor,
          dto.domicilio_receptor ?? null,
          dto.doc_tipo,
          dto.doc_nro,
          dto.cond_iva_receptor,

          dto.porcentaje_comision,

          toFixed4(netoCons),
          toFixed4(netoProp),
          importe_neto,
          importe_iva,
          importe_total,
          comNet,
          comIva,
          comTot,
          final_liquidar,

          buckets.Neto_0,
          buckets.Neto_025,
          buckets.IVA_025,
          buckets.Neto_05,
          buckets.IVA_05,
          buckets.Neto_105,
          buckets.IVA_105,
          buckets.Neto_21,
          buckets.IVA_21,
          buckets.Neto_27,
          buckets.IVA_27,

          dto.codigo_operacion_exento ?? ' ',
        ],
      );

      // 3.2 Insert items
      for (const it of items) {
        await qr.query(
          `INSERT INTO public.fac_liq_items
             (liquidacion_id, codigo, producto, alicuota_iva, exento, consignacion,
              cantidad, unit_neto, unit_iva, unit_total, neto, iva, total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            liq.id,
            it.Codigo ?? null,
            it.Producto ?? null,
            it.AlicuotaIVA,
            !!it.Exento,
            !!it.Consignacion,
            it.Cantidad,
            it._unitNet,
            it._unitIva,
            it._unitTot,
            it._neto,
            it._iva,
            it._total,
          ],
        );
      }

      // 3.3 Llamada a API externa (si electrónica) o marcar manual
      let apiResp: any = null;
      if (electronica) {
        const payload = {
          cuit_computador: null, // tu external client lo resuelve desde certificado si corresponde
          cuit_representado: null, // idem
          test: dto.test ?? true,
          electronica: true,
          token: dto.token ?? null,
          sign: dto.sign ?? null,
          punto_venta,
          metodo_pago: dto.metodo_pago ?? 1,
          factura_tipo,
          concepto: dto.concepto ?? 3,
          nro_remito: dto.nro_remito ?? null,
          fecha_liquidacion: liq.fecha_liquidacion,
          fecha_inicio_servicios: liq.fecha_inicio_servicios,
          fecha_fin_servicios: liq.fecha_fin_servicios,
          fecha_vto_pago: liq.fecha_vto_pago,
          moneda: liq.moneda,
          cotizacion: Number(liq.cotizacion),
          moneda_pago: liq.moneda_pago,
          razon_social_receptor: liq.razon_social_receptor,
          domicilio_receptor: liq.domicilio_receptor,
          doc_tipo: liq.doc_tipo,
          doc_nro: liq.doc_nro,
          cond_iva_receptor: liq.cond_iva_receptor,
          lista_productos: dto.lista_productos,
          porcentaje_comision: dto.porcentaje_comision,
          codigo_operacion_exento: dto.codigo_operacion_exento ?? ' ',
        };

        const { request_id } = await this.logger.begin(
          'POST /liquidaciones',
          payload,
        );
        try {
          apiResp = await this.http.postLiquidaciones(payload);
          await this.logger.endOk(request_id, apiResp);
        } catch (err: any) {
          await this.logger.endError(request_id, err);
          throw new BadRequestException(
            err?.message || 'Error emitiendo liquidación electrónica',
          );
        }

        // Guardar datos devueltos por la API externa
        await qr.query(
          `UPDATE public.fac_liquidaciones
           SET cae = $2, cae_vencimiento = $3, qr_url = $4,
               nro_comprobante = $5,
               estado = 'ACEPTADA',
               resp_raw = $6
           WHERE id = $1`,
          [
            liq.id,
            apiResp?.cae ?? null,
            apiResp?.vencimiento ?? null,
            apiResp?.qr_url ?? null,
            apiResp?.nro_comprobante ?? null,
            JSON.stringify(apiResp ?? {}),
          ],
        );
      } else {
        // Manual: debe venir comprobante_nro
        if (!dto.comprobante_nro) {
          throw new BadRequestException(
            'Para liquidación manual se requiere comprobante_nro',
          );
        }
        await qr.query(
          `UPDATE public.fac_liquidaciones
           SET nro_comprobante = $2,
               estado = 'MANUAL',
               resp_raw = $3
           WHERE id = $1`,
          [liq.id, dto.comprobante_nro, JSON.stringify({ manual: true })],
        );
      }

      await qr.commitTransaction();
      return this.detalle(liq.id);
    } catch (e: any) {
      await qr.rollbackTransaction();
      throw new BadRequestException(
        e?.message || 'Error creando/emitiendo liquidación',
      );
    } finally {
      await qr.release();
    }
  }

  // ---------------- Listado ----------------
  async listar(q: QueryLiquidacionesDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conds: string[] = ['1=1'];
    const params: any[] = [];
    let p = 1;

    if (q.emisor_id) {
      conds.push(`l.emisor_id = $${p++}`);
      params.push(q.emisor_id);
    }
    if (q.electronica !== undefined) {
      conds.push(`l.electronica = $${p++}`);
      params.push(q.electronica);
    }
    if (q.punto_venta) {
      conds.push(`l.punto_venta = $${p++}`);
      params.push(q.punto_venta);
    }
    if (q.factura_tipo) {
      conds.push(`l.factura_tipo = $${p++}`);
      params.push(q.factura_tipo);
    }
    if (q.referencia_interna?.trim()) {
      conds.push(`l.referencia_interna ILIKE $${p++}`);
      params.push(`%${q.referencia_interna.trim()}%`);
    }
    if (q.desde) {
      conds.push(`l.created_at >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      conds.push(`l.created_at < $${p++}`);
      params.push(new Date(q.hasta));
    }

    const where = conds.join(' AND ');
    const idxLimit = p++,
      idxOffset = p++;

    const baseSql = `
      SELECT
        l.id, l.created_at, l.estado,
        l.emisor_id, l.referencia_interna, l.electronica,
        l.factura_tipo, l.punto_venta, l.nro_comprobante,
        l.razon_social_receptor, l.doc_tipo, l.doc_nro,
        l.importe_total, l.final_liquidar
      FROM public.fac_liquidaciones l
      WHERE ${where}
      ORDER BY l.created_at ${order}, l.id ${order}
      LIMIT $${idxLimit} OFFSET $${idxOffset};
    `;
    const countSql = `SELECT COUNT(1)::int AS c FROM public.fac_liquidaciones l WHERE ${where};`;

    const [rows, total] = await Promise.all([
      this.ds.query(baseSql, [...params, limit, offset]),
      this.ds.query(countSql, params).then((r) => Number(r?.[0]?.c || 0)),
    ]);

    return { data: rows, total, page, limit };
  }

  // ---------------- Detalle ----------------
  async detalle(id: string) {
    const liq = await this.ds.query(
      `SELECT * FROM public.fac_liquidaciones WHERE id = $1`,
      [id],
    );
    if (!liq?.length) throw new NotFoundException('Liquidación no encontrada');

    const items = await this.ds.query(
      `SELECT id, codigo, producto, alicuota_iva, exento, consignacion,
              cantidad, unit_neto, unit_iva, unit_total, neto, iva, total
       FROM public.fac_liq_items WHERE liquidacion_id = $1 ORDER BY id ASC`,
      [id],
    );

    return { liquidacion: liq[0], items };
  }
}

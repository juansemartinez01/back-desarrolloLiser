import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateCompraDto } from './dto/create-compra.dto';
import { QueryComprasDto } from './dto/query-compras.dto';
import { FactuExternalClient } from '../http/factu-external.client';
import { ApiLoggerService } from '../services/api-logger.service';

function fx4(n: number) {
  return Number((n ?? 0).toFixed(4));
}

@Injectable()
export class ComprasService {
  constructor(
    private readonly ds: DataSource,
    private readonly http: FactuExternalClient,
    private readonly logger: ApiLoggerService,
  ) {}

  private _calcImporteIva(dto: CreateCompraDto) {
    return fx4(
      (dto.IVA_025 ?? 0) +
        (dto.IVA_05 ?? 0) +
        (dto.IVA_105 ?? 0) +
        (dto.IVA_21 ?? 0) +
        (dto.IVA_27 ?? 0),
    );
  }

  private _calcImporteNeto(dto: CreateCompraDto) {
    return fx4(
      (dto.Neto_0 ?? 0) +
        (dto.Neto_025 ?? 0) +
        (dto.Neto_05 ?? 0) +
        (dto.Neto_105 ?? 0) +
        (dto.Neto_21 ?? 0) +
        (dto.Neto_27 ?? 0),
    );
  }

  private _cantAlicuotas(dto: CreateCompraDto) {
    return [
      dto.Neto_0,
      dto.Neto_025,
      dto.Neto_05,
      dto.Neto_105,
      dto.Neto_21,
      dto.Neto_27,
    ].filter((v) => (v ?? 0) > 0).length;
  }

  // Idempotencia: por combinación única del comprobante + proveedor
  // (doc_tipo_vendedor, doc_nro_vendedor, comprobante_tipo, punto_venta, nro_comprobante)
  async crearCompra(dto: CreateCompraDto) {
    // Validaciones de consistencia de importes
    const importe_iva = this._calcImporteIva(dto);
    const importe_neto = this._calcImporteNeto(dto);

    const recomputed_total = fx4(
      importe_neto +
        (dto.importe_no_gravado ?? 0) +
        (dto.importe_exento ?? 0) +
        importe_iva +
        (dto.percep_iva ?? 0) +
        (dto.percep_otros_nacionales ?? 0) +
        (dto.percep_iibb ?? 0) +
        (dto.percep_municipales ?? 0) +
        (dto.impuestos_internos ?? 0) +
        (dto.otros_tributos ?? 0),
    );

    if (Math.abs(recomputed_total - fx4(dto.importe_total)) > 0.01) {
      throw new BadRequestException(
        `importe_total inconsistente. Enviado=${dto.importe_total}, Recalculado=${recomputed_total}`,
      );
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Idempotencia: si ya existe, devolver
      const idem = await qr.query(
        `SELECT id FROM public.fac_compras
         WHERE doc_tipo_vendedor = $1 AND doc_nro_vendedor = $2
           AND comprobante_tipo = $3 AND punto_venta = $4 AND nro_comprobante = $5
         LIMIT 1`,
        [
          dto.doc_tipo_vendedor,
          dto.doc_nro_vendedor,
          dto.comprobante_tipo,
          dto.punto_venta,
          dto.nro_comprobante,
        ],
      );
      if (idem?.length) {
        await qr.rollbackTransaction();
        return this.detalle(idem[0].id);
      }

      // Persistir fila base en estado 'REGISTRADA' (antes/independiente del externo)
      const [row] = await qr.query(
        `INSERT INTO public.fac_compras
           (fecha_emision, comprobante_tipo, punto_venta, nro_comprobante, cae,
            clasificacion,
            doc_tipo_vendedor, doc_nro_vendedor, nombre_vendedor,
            despacho_importacion,
            importe_total, importe_no_gravado, importe_exento,
            percep_iva, percep_otros_nacionales, percep_iibb, percep_municipales, impuestos_internos,
            neto_0, neto_025, iva_025, neto_05, iva_05, neto_105, iva_105, neto_21, iva_21, neto_27, iva_27,
            importe_iva, importe_neto,
            moneda, cotizacion,
            codigo_operacion_exento,
            credito_fiscal_computable, otros_tributos,
            intermediacion_tercero, cuit_emisor_corredor, denom_emisor_corredor, iva_comision,
            tipo_comp_original, pto_venta_original, nro_comp_original,
            cant_alicuotas,
            referencia_interna,
            estado)
         VALUES ($1,$2,$3,$4,$5,
                 $6,
                 $7,$8,$9,
                 $10,
                 $11,$12,$13,
                 $14,$15,$16,$17,$18,
                 $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,
                 $30,$31,
                 $32,$33,
                 $34,
                 $35,$36,
                 $37,$38,$39,$40,
                 $41,$42,$43,
                 $44,
                 $45,
                 'REGISTRADA')
         RETURNING *`,
        [
          dto.fecha_emision,
          dto.comprobante_tipo,
          dto.punto_venta,
          dto.nro_comprobante,
          dto.cae,
          dto.clasificacion,
          dto.doc_tipo_vendedor,
          dto.doc_nro_vendedor,
          dto.nombre_vendedor,
          dto.despacho_importacion ?? null,
          fx4(dto.importe_total),
          fx4(dto.importe_no_gravado),
          fx4(dto.importe_exento),
          fx4(dto.percep_iva),
          fx4(dto.percep_otros_nacionales),
          fx4(dto.percep_iibb),
          fx4(dto.percep_municipales),
          fx4(dto.impuestos_internos),
          fx4(dto.Neto_0),
          fx4(dto.Neto_025),
          fx4(dto.IVA_025),
          fx4(dto.Neto_05),
          fx4(dto.IVA_05),
          fx4(dto.Neto_105),
          fx4(dto.IVA_105),
          fx4(dto.Neto_21),
          fx4(dto.IVA_21),
          fx4(dto.Neto_27),
          fx4(dto.IVA_27),
          importe_iva,
          importe_neto,
          dto.moneda,
          dto.cotizacion,
          dto.codigo_operacion_exento,
          fx4(dto.credito_fiscal_computable),
          fx4(dto.otros_tributos),
          !!dto.intermediacion_tercero,
          dto.cuit_emisor_corredor ?? null,
          dto.denom_emisor_corredor ?? null,
          fx4(dto.iva_comision ?? 0),
          dto.tipo_comprobante_original ?? null,
          dto.pto_venta_original ?? null,
          dto.nro_comprobante_original ?? null,
          this._cantAlicuotas(dto),
          dto.referencia_interna ?? null,
        ],
      );

      // Llamada a API externa /compras (para generar TXT, validaciones y normalizaciones)
      const extPayload = { ...dto }; // el cliente externo espera el mismo shape
      const request_id = crypto.randomUUID();
      let extResp: any = null;
      try {
        extResp = await this.http.postCompras(extPayload);
      } catch (err: any) {
        // No rompemos el registro: guardamos estado = ERROR_EXT y devolvemos detalle con error
        await qr.query(
          `UPDATE public.fac_compras
           SET estado = 'ERROR_EXT', resp_raw = $2
           WHERE id = $1`,
          [row.id, JSON.stringify({ error: err?.message || err })],
        );
        await qr.commitTransaction();
        const det = await this.detalle(row.id);
        (det as any).warning =
          'Registrada localmente pero falló la integración externa';
        return det;
      }

      // Guardar respuesta (TXT y cálculos del externo)
      await qr.query(
        `UPDATE public.fac_compras
         SET estado = 'ACEPTADA',
             txt_compras = $2,
             txt_alicuotas_compras = $3,
             txt_importacion_compras = $4,
             resp_raw = $5
         WHERE id = $1`,
        [
          row.id,
          extResp?.txt_compras ?? null,
          extResp?.txt_alicuotas_compras
            ? JSON.stringify(extResp.txt_alicuotas_compras)
            : null,
          extResp?.txt_importacion_compras
            ? JSON.stringify(extResp.txt_importacion_compras)
            : null,
          JSON.stringify(extResp ?? {}),
        ],
      );

      await qr.commitTransaction();
      return this.detalle(row.id);
    } catch (e: any) {
      await qr.rollbackTransaction();
      throw new BadRequestException(e?.message || 'Error registrando compra');
    } finally {
      await qr.release();
    }
  }

  async listar(q: QueryComprasDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conds: string[] = ['1=1'];
    const params: any[] = [];
    let p = 1;

    if (q.comprobante_tipo) {
      conds.push(`c.comprobante_tipo = $${p++}`);
      params.push(q.comprobante_tipo);
    }
    if (q.punto_venta) {
      conds.push(`c.punto_venta = $${p++}`);
      params.push(q.punto_venta);
    }
    if (q.nro_comprobante) {
      conds.push(`c.nro_comprobante = $${p++}`);
      params.push(q.nro_comprobante);
    }
    if (q.doc_tipo_vendedor) {
      conds.push(`c.doc_tipo_vendedor = $${p++}`);
      params.push(q.doc_tipo_vendedor);
    }
    if (q.doc_nro_vendedor) {
      conds.push(`c.doc_nro_vendedor = $${p++}`);
      params.push(q.doc_nro_vendedor);
    }
    if (q.nombre_vendedor?.trim()) {
      conds.push(`c.nombre_vendedor ILIKE $${p++}`);
      params.push(`%${q.nombre_vendedor.trim()}%`);
    }
    if (q.desde) {
      conds.push(`c.created_at >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      conds.push(`c.created_at < $${p++}`);
      params.push(new Date(q.hasta));
    }

    const where = conds.join(' AND ');
    const idxLimit = p++,
      idxOffset = p++;

    const baseSql = `
      SELECT
        c.id, c.created_at, c.estado,
        c.comprobante_tipo, c.punto_venta, c.nro_comprobante,
        c.doc_tipo_vendedor, c.doc_nro_vendedor, c.nombre_vendedor,
        c.importe_total, c.importe_iva, c.importe_neto
      FROM public.fac_compras c
      WHERE ${where}
      ORDER BY c.created_at ${order}, c.id ${order}
      LIMIT $${idxLimit} OFFSET $${idxOffset};
    `;
    const countSql = `SELECT COUNT(1)::int AS c FROM public.fac_compras c WHERE ${where};`;

    const [rows, total] = await Promise.all([
      this.ds.query(baseSql, [...params, limit, offset]),
      this.ds.query(countSql, params).then((r) => Number(r?.[0]?.c || 0)),
    ]);

    return { data: rows, total, page, limit };
  }

  async detalle(id: string) {
    const r = await this.ds.query(
      `SELECT * FROM public.fac_compras WHERE id = $1`,
      [id],
    );
    if (!r?.length) throw new NotFoundException('Compra no encontrada');
    return { compra: r[0] };
  }
}

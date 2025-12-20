import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateFacturaDto } from './dto/create-factura.dto';
import { QueryFacturasDto } from './dto/query-facturas.dto';
import { FactuExternalClient } from '../http/factu-external.client';
import { ApiLoggerService } from '../services/api-logger.service';
import { normalizeItem, resumir } from './utils/factura-calc.util';

function dec4(n: number | string) {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(4);
}
function dec6(n: number | string) {
  const v = typeof n === 'string' ? Number(n) : n;
  return v.toFixed(6);
}

@Injectable()
export class FacturasService {
  constructor(
    private readonly ds: DataSource,
    private readonly ext: FactuExternalClient,
    private readonly logger: ApiLoggerService,
  ) {}

  // --- Crear + Emitir --------------------------------------------------------
  async crearYEmitir(dto: CreateFacturaDto) {
    if (!dto.lista_productos?.length) {
      throw new BadRequestException('lista_productos requerida');
    }

    // 1) Traer emisor
    const [emi] = await this.ds.query(
      `SELECT id, cuit_computador, cuit_representado, test, activo
       FROM public.fac_emisores WHERE id = $1`,
      [dto.emisor_id],
    );
    if (!emi) throw new BadRequestException('Emisor inexistente');
    if (!emi.activo) throw new BadRequestException('Emisor inactivo');

    // 2) Idempotencia: ya existe emitida?
    if (dto.referencia_interna) {
      const dup = await this.ds.query(
        `SELECT id, estado FROM public.fac_facturas
         WHERE emisor_id = $1 AND referencia_interna = $2
           AND factura_tipo = COALESCE($3, factura_tipo)
           AND punto_venta = COALESCE($4, punto_venta)
         ORDER BY created_at DESC LIMIT 1`,
        [
          dto.emisor_id,
          dto.referencia_interna,
          dto.factura_tipo ?? null,
          dto.punto_venta ?? null,
        ],
      );
      if (dup?.length && dup[0].estado === 'ACEPTADA') {
        return this.detalle(dup[0].id);
      }
    }

    // 3) Normalizar items + sumar
    const norm = dto.lista_productos.map(normalizeItem);
    const sums = resumir(norm);

    // 4) Insert cabecera + items en TX (estado PENDIENTE)
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const [fac] = await qr.query(
        `INSERT INTO public.fac_facturas
           (emisor_id, referencia_interna,
            razon_social_receptor, doc_tipo, doc_nro, cond_iva_receptor,
            factura_tipo, punto_venta, concepto, moneda, cotizacion,
            importe_total, importe_neto, importe_iva,
            importe_no_gravado, importe_exento, importe_tributos,
            tipo_comprobante_original, pto_venta_original, nro_comprobante_original, cuit_receptor_comprobante_original,
            estado)
         VALUES ($1,$2,$3,COALESCE($4,99),COALESCE($5,0),COALESCE($6,5),
                 COALESCE($7,11),COALESCE($8,1),COALESCE($9,1),
                 COALESCE($10,'PES'),COALESCE($11,1),
                 $12,$13,$14,
                 COALESCE($15,0),COALESCE($16,0),COALESCE($17,0),
                 $18,$19,$20,$21,
                 'PENDIENTE')
         RETURNING *`,
        [
          dto.emisor_id,
          dto.referencia_interna ?? null,
          dto.razon_social_receptor ?? null,
          dto.doc_tipo ?? null,
          dto.doc_nro ?? null,
          dto.cond_iva_receptor ?? null,
          dto.factura_tipo ?? null,
          dto.punto_venta ?? null,
          dto.concepto ?? null,
          dto.moneda ?? null,
          dto.cotizacion ?? null,
          dec4(sums.total),
          dec4(sums.total_neto),
          dec4(sums.total_iva),
          dto.importe_no_gravado ?? 0,
          dto.importe_exento ?? 0,
          dto.importe_tributos ?? 0,
          dto.tipo_comprobante_original ?? null,
          dto.pto_venta_original ?? null,
          dto.nro_comprobante_original ?? null,
          dto.cuit_receptor_comprobante_original ?? null,
        ],
      );

      for (const it of norm) {
        await qr.query(
          `INSERT INTO public.fac_facturas_items
     (factura_id, codigo, producto, alicuota_iva, exento, consignacion,
      cantidad, precio_unitario_total, precio_unitario_neto, iva_unitario,
      total_neto, total_iva, total_con_iva)
   VALUES ($1,$2,$3,$4,COALESCE($5,false),COALESCE($6,true),
           $7,$8,$9,$10,$11,$12,$13)`,
          [
            fac.id,
            (it as any).Codigo ?? null,
            (it as any).Producto ?? null,
            it.AlicuotaIVA,
            it.Exento ?? false,
            it.Consignacion ?? true,
            dec6(it.Cantidad),
            it.Precio_Unitario_Total != null
              ? dec6(it.Precio_Unitario_Total)
              : null,
            it.Precio_Unitario_Neto != null
              ? dec6(it.Precio_Unitario_Neto)
              : null,
            it.IVA_Unitario != null ? dec6(it.IVA_Unitario) : null,
            dec4(it.t_neto),
            dec4(it.t_iva),
            dec4(it.t_total),
          ],
        );

      }

      await qr.commitTransaction();

      // 5) Armar payload externo
      const payload = {
        cuit_computador: Number(emi.cuit_computador),
        cuit_representado: Number(emi.cuit_representado),
        importe_total: Number(sums.total.toFixed(2)),
        test: typeof dto.test === 'boolean' ? dto.test : !!emi.test,
        punto_venta: dto.punto_venta ?? 1,
        factura_tipo: dto.factura_tipo ?? 11,
        metodo_pago: 1,
        importe_neto: Number(sums.total_neto.toFixed(2)),
        importe_iva: Number(sums.total_iva.toFixed(2)),
        importe_no_gravado: Number((dto.importe_no_gravado ?? 0).toFixed(2)),
        importe_exento: Number((dto.importe_exento ?? 0).toFixed(2)),
        importe_tributos: Number((dto.importe_tributos ?? 0).toFixed(2)),
        lista_productos: dto.lista_productos.map((x) => ({
          Codigo: x.Codigo ?? null,
          Producto: x.Producto ?? null,
          AlicuotaIVA: x.AlicuotaIVA,
          Exento: !!x.Exento,
          Consignacion: x.Consignacion ?? true,
          Cantidad: x.Cantidad,
          Precio_Unitario_Total: x.Precio_Unitario_Total ?? null,
          Precio_Unitario_Neto: x.Precio_Unitario_Neto ?? null,
          IVA_Unitario: x.IVA_Unitario ?? null,
        })),
        razon_social_receptor: dto.razon_social_receptor ?? null,
        doc_tipo: dto.doc_tipo ?? 99,
        doc_nro: dto.doc_nro ?? 0,
        cond_iva_receptor: dto.cond_iva_receptor ?? 5,
        concepto: dto.concepto ?? 1,
        moneda: dto.moneda ?? 'PES',
        moneda_pago: 'N',
        cotizacion: Number((dto.cotizacion ?? 1).toFixed(6)),
        tipo_comprobante_original: dto.tipo_comprobante_original ?? null,
        pto_venta_original: dto.pto_venta_original ?? null,
        nro_comprobante_original: dto.nro_comprobante_original ?? null,
        cuit_receptor_comprobante_original:
          dto.cuit_receptor_comprobante_original ?? null,
        codigo_operacion_exento: dto.codigo_operacion_exento ?? ' ',
      };

      // 6) Call externo + persistir respuesta/errores
      let respuesta: any;
      try {
        respuesta = await this.ext.postFacturas(payload, {
          emisor_id: dto.emisor_id,
        });
      } catch (e: any) {
        const msg = e?.message || 'Error llamando /facturas';
        await this.ds.query(
          `UPDATE public.fac_facturas SET estado='ERROR', error_msj=$1, updated_at=now() WHERE id=$2`,
          [msg, fac.id],
        );
        throw new BadRequestException(msg);
      }

      // 7) Persistir salida AFIP
      const upd = await this.ds.query(
        `UPDATE public.fac_facturas
           SET estado='ACEPTADA',
               cae = $1,
               cae_vencimiento = $2,
               fecha_emision = $3,
               qr_url = $4,
               nro_comprobante = $5,
               txt_venta = $6,
               txt_alicuotas_venta = $7,
               updated_at=now()
         WHERE id = $8
         RETURNING *`,
        [
          respuesta.cae ?? null,
          respuesta.vencimiento ? new Date(respuesta.vencimiento) : null,
          respuesta.fecha ? new Date(respuesta.fecha) : new Date(),
          respuesta.qr_url ?? null,
          respuesta.nro_comprobante ?? null,
          respuesta.txt_venta ?? null,
          respuesta.txt_alicuotas_venta ?? null,
          fac.id,
        ],
      );

      return { ok: true, factura: upd[0] };
    } catch (e) {
      try {
        await qr.rollbackTransaction();
      } catch {}
      throw e;
    } finally {
      try {
        await qr.release();
      } catch {}
    }
  }

  // --- Listar ----------------------------------------------------------------
  async listar(q: QueryFacturasDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 500);
    const offset = (page - 1) * limit;
    const order = (q.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conds: string[] = ['1=1'];
    const params: any[] = [];
    let p = 1;

    if (q.emisor_id) {
      conds.push(`f.emisor_id = $${p++}`);
      params.push(q.emisor_id);
    }
    if (q.referencia_interna) {
      conds.push(`f.referencia_interna ILIKE $${p++}`);
      params.push(`%${q.referencia_interna}%`);
    }
    if (q.estado) {
      conds.push(`f.estado = $${p++}`);
      params.push(q.estado);
    }
    if (q.desde) {
      conds.push(`f.created_at >= $${p++}`);
      params.push(new Date(q.desde));
    }
    if (q.hasta) {
      conds.push(`f.created_at < $${p++}`);
      params.push(new Date(q.hasta));
    }

    const where = conds.join(' AND ');
    const listSql = `
      SELECT f.*
      FROM public.fac_facturas f
      WHERE ${where}
      ORDER BY f.created_at ${order}, f.id ${order}
      LIMIT $${p++} OFFSET $${p++}`;
    const countSql = `SELECT COUNT(1)::int AS c FROM public.fac_facturas f WHERE ${where}`;

    const [rows, total] = await Promise.all([
      this.ds.query(listSql, [...params, limit, offset]),
      this.ds
        .query(countSql, params)
        .then((r) => (r?.[0]?.c ? Number(r[0].c) : 0)),
    ]);

    return { data: rows, total, page, limit };
  }

  // --- Detalle ---------------------------------------------------------------
  async detalle(id: string) {
    const fac = await this.ds.query(
      `SELECT * FROM public.fac_facturas WHERE id=$1`,
      [id],
    );
    if (!fac?.length) throw new NotFoundException('Factura no encontrada');
    const items = await this.ds.query(
      `SELECT * FROM public.fac_facturas_items WHERE factura_id=$1 ORDER BY created_at ASC`,
      [id],
    );
    return { factura: fac[0], items };
  }
}

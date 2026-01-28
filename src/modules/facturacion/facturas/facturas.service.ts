import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateFacturaDto } from './dto/create-factura.dto';
import { QueryFacturasDto } from './dto/query-facturas.dto';
import { FactuExternalClient } from '../http/factu-external.client';

import { normalizeItem, resumir } from './utils/factura-calc.util';
import { ConsultarCondicionIvaDto } from '../emisores/dto/consultar-condicion-iva.dto';
import axios from 'axios';

function pctToAfipCode(pct: number): number {
  // tolerancia por decimales
  const x = Math.round(pct * 100) / 100;

  if (x === 0) return 3; // 0%
  if (x === 2.5) return 4; // 2.5%
  if (x === 10.5) return 5; // 10.5%
  if (x === 21) return 6; // 21%
  if (x === 27) return 8; // 27%

  // fallback: si viene algo raro, lo tratás como 21 o lo rechazás
  throw new BadRequestException(`Alicuota IVA no soportada: ${pct}`);
}

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
  private readonly logger = new Logger(FacturasService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly ext: FactuExternalClient,
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

    // 3) Traer productos por ID (bulk)
    const ids = dto.lista_productos.map((x) => x.ProductoId);
    const productos = await this.ds.query(
      `SELECT id, nombre, alicuota_iva, exento_iva, facturable, activo
   FROM public.stk_productos
   WHERE id = ANY($1::int[])`,
      [ids],
    );

    const byId = new Map<number, any>(productos.map((p) => [Number(p.id), p]));

    // validar que existan todos
    for (const id of ids) {
      const p = byId.get(id);
      if (!p) throw new BadRequestException(`Producto inexistente: ${id}`);
      if (!p.activo) throw new BadRequestException(`Producto inactivo: ${id}`);
      if (!p.facturable)
        throw new BadRequestException(`Producto no facturable: ${id}`);
    }

    const itemsEnriquecidos = dto.lista_productos.map((x) => {
      const p = byId.get(x.ProductoId);

      const exento = !!p.exento_iva;
      const pct = Number(p.alicuota_iva); // viene numeric string
      const afipCode = exento ? 3 : pctToAfipCode(pct);

      return {
        // datos para persistir / mostrar
        ProductoId: x.ProductoId,
        Producto: p.nombre,
        // lo que usa el cálculo
        AlicuotaIVA: afipCode,
        Exento: exento,
        Consignacion: true, // si lo manejás por producto, lo sacás también de stk_productos
        Cantidad: x.Cantidad,
        Precio_Unitario_Total: x.Precio_Unitario_Total,
        Precio_Unitario_Neto: x.Precio_Unitario_Neto,
        IVA_Unitario: x.IVA_Unitario,
      };
    });


    // 3) Normalizar items + sumar
    const norm = itemsEnriquecidos.map(normalizeItem);
    const sums = resumir(norm);


    // --- Cálculo de importes coherente con AFIP -------------------------------
    const facturaTipo = dto.factura_tipo ?? 11; // 11 = C por defecto

    const total = sums.total; // total con IVA
    const netoBase = sums.total_neto; // neto calculado
    const ivaBase = sums.total_iva; // IVA calculado

    const importeNoGravadoBase = dto.importe_no_gravado ?? 0;
    const importeExentoBase = dto.importe_exento ?? 0;
    const importeTribBase = dto.importe_tributos ?? 0;

    let importeTotal = total;
    let importeNeto = netoBase;
    let importeIva = ivaBase;
    let importeNoGravado = importeNoGravadoBase;
    let importeExento = importeExentoBase;
    let importeTributos = importeTribBase;

    // Para FACTURA C (11): ImpTotal = ImpNeto + ImpTrib, IVA = 0
    if (facturaTipo === 11) {
      importeIva = 0;
      importeNeto = importeTotal - importeTributos;
    }

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
               $15,$16,$17,
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
          dec4(importeTotal),
          dec4(importeNeto),
          dec4(importeIva),
          dec4(importeNoGravado),
          dec4(importeExento),
          dec4(importeTributos),
          dto.tipo_comprobante_original ?? null,
          dto.pto_venta_original ?? null,
          dto.nro_comprobante_original ?? null,
          dto.cuit_receptor_comprobante_original ?? null,
        ],
      );

      for (const it of norm) {
        await qr.query(
                  `INSERT INTO public.fac_facturas_items
          (factura_id, producto_id, codigo, producto, alicuota_iva, exento, consignacion,
            cantidad, precio_unitario_total, precio_unitario_neto, iva_unitario,
            total_neto, total_iva, total_con_iva)
          VALUES ($1,$2,$3,$4,$5,COALESCE($6,false),COALESCE($7,true),
                  $8,$9,$10,$11,$12,$13,$14)`,
          [
            fac.id,
            (it as any).ProductoId ?? null,
            null, // si querés, podés mapear a algún “codigo” interno
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
        importe_total: Number(importeTotal.toFixed(2)),
        test: typeof dto.test === 'boolean' ? dto.test : !!emi.test,
        punto_venta: dto.punto_venta ?? 1,
        factura_tipo: facturaTipo,
        metodo_pago: 1,
        importe_neto: Number(importeNeto.toFixed(2)),
        importe_iva: Number(importeIva.toFixed(2)),
        importe_no_gravado: Number(importeNoGravado.toFixed(2)),
        importe_exento: Number(importeExento.toFixed(2)),
        importe_tributos: Number(importeTributos.toFixed(2)),
        lista_productos: itemsEnriquecidos.map((x) => ({
          Codigo: null,
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

  async consultarCondicionIva(dto: ConsultarCondicionIvaDto) {
    if (!dto?.cuit_consulta) {
      throw new BadRequestException('cuit_consulta requerido');
    }

    try {
      // si querés loguear / asociar a un emisor, agregalo en opts
      return await this.ext.postConsultarCondicionIva({
        cuit_consulta: dto.cuit_consulta,
      });
    } catch (e: any) {
      // el client ya te lo transforma en BadRequestException con mensaje útil
      // pero si querés mantener el contrato 502 en este endpoint:
      throw new BadGatewayException(
        e?.message ?? 'Error consultando condición IVA',
      );
    }
  }
}

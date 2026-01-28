import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateNotaDto } from './dto/create-nota.dto';
import { FacturasService } from '../facturas/facturas.service';

// Map AFIP: factura A/B/C -> NC / ND
const MAP_NC: Record<number, number> = { 1: 3, 6: 8, 11: 13 }; // A->NC A(3) ; B->8 ; C->13
const MAP_ND: Record<number, number> = { 1: 2, 6: 7, 11: 12 }; // A->ND A(2) ; B->7 ; C->12

type FacturaItemForCreate = {
  ProductoId: number;
  Cantidad: number;
  Precio_Unitario_Total?: number;
  Precio_Unitario_Neto?: number;
  IVA_Unitario?: number;
};

@Injectable()
export class NotasService {
  constructor(
    private readonly ds: DataSource,
    private readonly facturas: FacturasService, // reutilizamos flujo emitir
  ) {}

  // Helpers ------------------------------------------------
  private async _loadOriginalByDto(dto: CreateNotaDto) {
    // 1) por id local
    if (dto.factura_original_id) {
      const fac = await this.ds.query(
        `SELECT * FROM public.fac_facturas WHERE id = $1`,
        [dto.factura_original_id],
      );
      if (!fac?.length)
        throw new NotFoundException('Factura original no encontrada');
      return fac[0];
    }

    // 2) por tripleta oficial
    if (
      dto.tipo_comprobante_original &&
      dto.pto_venta_original &&
      dto.nro_comprobante_original
    ) {
      const fac = await this.ds.query(
        `SELECT * FROM public.fac_facturas
         WHERE factura_tipo = $1 AND punto_venta = $2 AND nro_comprobante = $3`,
        [
          dto.tipo_comprobante_original,
          dto.pto_venta_original,
          dto.nro_comprobante_original,
        ],
      );
      if (!fac?.length)
        throw new NotFoundException('Factura original no encontrada');
      return fac[0];
    }

    throw new BadRequestException(
      'Debe indicar factura_original_id o (tipo/pto/nro) de la original',
    );
  }

  private _inferTipoNota(isNC: boolean, tipoOriginal: number): number {
    const map = isNC ? MAP_NC : MAP_ND;
    const t = map[tipoOriginal];
    if (!t)
      throw new BadRequestException(
        'No se pudo inferir el tipo de comprobante para la nota',
      );
    return t;
  }

  private async _loadItemsOriginalesAsFacturaItems(
    facturaId: string,
  ): Promise<FacturaItemForCreate[]> {
    const rows = await this.ds.query(
      `SELECT
         producto_id,
         cantidad,
         precio_unitario_total,
         precio_unitario_neto,
         iva_unitario
       FROM public.fac_facturas_items
       WHERE factura_id = $1
       ORDER BY created_at ASC`,
      [facturaId],
    );

    if (!rows.length) {
      throw new BadRequestException('La factura original no tiene items');
    }

    return rows.map((it: any) => {
      if (it.producto_id == null) {
        throw new BadRequestException(
          'La factura original tiene items sin producto_id (migración pendiente o datos viejos)',
        );
      }

      const item: FacturaItemForCreate = {
        ProductoId: Number(it.producto_id),
        Cantidad: Number(it.cantidad),
      };

      // Preferimos Total si existe (mantiene comportamiento similar a tu facturación actual)
      if (it.precio_unitario_total != null) {
        item.Precio_Unitario_Total = Number(it.precio_unitario_total);
      }
      if (it.precio_unitario_neto != null) {
        item.Precio_Unitario_Neto = Number(it.precio_unitario_neto);
      }
      if (it.iva_unitario != null) {
        item.IVA_Unitario = Number(it.iva_unitario);
      }

      // Validación mínima: debe existir algún precio
      if (
        item.Precio_Unitario_Total == null &&
        item.Precio_Unitario_Neto == null
      ) {
        throw new BadRequestException(
          `Item original inválido (sin precio): producto_id=${item.ProductoId}`,
        );
      }

      return item;
    });
  }

  // NC -----------------------------------------------------
  async emitirNC(dto: CreateNotaDto) {
    const orig = await this._loadOriginalByDto(dto);

    if (orig.emisor_id !== dto.emisor_id) {
      throw new BadRequestException(
        'El emisor no coincide con la factura original',
      );
    }
    if (orig.estado !== 'ACEPTADA') {
      throw new BadRequestException('La factura original debe estar ACEPTADA');
    }

    const factura_tipo =
      dto.factura_tipo ?? this._inferTipoNota(true, Number(orig.factura_tipo));
    const punto_venta = dto.punto_venta ?? Number(orig.punto_venta);

    const receptor = {
      razon_social_receptor:
        dto.razon_social_receptor ?? orig.razon_social_receptor ?? null,
      doc_tipo: dto.doc_tipo ?? Number(orig.doc_tipo ?? 99),
      doc_nro: dto.doc_nro ?? Number(orig.doc_nro ?? 0),
      cond_iva_receptor:
        dto.cond_iva_receptor ?? Number(orig.cond_iva_receptor ?? 5),
    };

    const referencia_interna =
      dto.referencia_interna ?? `NC:${orig.id}:${punto_venta}-${factura_tipo}`;

    // ✅ clave: reconstruimos lista_productos con ProductoId desde la factura original
    const listaProductos = await this._loadItemsOriginalesAsFacturaItems(
      orig.id,
    );

    return this.facturas.crearYEmitir({
      emisor_id: dto.emisor_id,
      referencia_interna,
      ...receptor,
      factura_tipo,
      punto_venta,

      tipo_comprobante_original: Number(orig.factura_tipo),
      pto_venta_original: Number(orig.punto_venta),
      nro_comprobante_original: Number(orig.nro_comprobante),
      cuit_receptor_comprobante_original:
        dto.cuit_receptor_comprobante_original ?? undefined,

      concepto: 1,
      moneda: dto.moneda ?? 'PES',
      cotizacion: dto.cotizacion ?? 1,

      // ✅ acá va la lista reconstruida (no dto.lista_productos)
      lista_productos: listaProductos,

      test: dto.test ?? undefined,
      codigo_operacion_exento: dto.codigo_operacion_exento ?? ' ',
    });
  }

  // ND -----------------------------------------------------
  async emitirND(dto: CreateNotaDto) {
    const orig = await this._loadOriginalByDto(dto);

    if (orig.emisor_id !== dto.emisor_id) {
      throw new BadRequestException(
        'El emisor no coincide con la factura original',
      );
    }
    if (orig.estado !== 'ACEPTADA') {
      throw new BadRequestException('La factura original debe estar ACEPTADA');
    }

    const factura_tipo =
      dto.factura_tipo ?? this._inferTipoNota(false, Number(orig.factura_tipo));
    const punto_venta = dto.punto_venta ?? Number(orig.punto_venta);

    const receptor = {
      razon_social_receptor:
        dto.razon_social_receptor ?? orig.razon_social_receptor ?? null,
      doc_tipo: dto.doc_tipo ?? Number(orig.doc_tipo ?? 99),
      doc_nro: dto.doc_nro ?? Number(orig.doc_nro ?? 0),
      cond_iva_receptor:
        dto.cond_iva_receptor ?? Number(orig.cond_iva_receptor ?? 5),
    };

    const referencia_interna =
      dto.referencia_interna ?? `ND:${orig.id}:${punto_venta}-${factura_tipo}`;

    // ✅ clave: reconstruimos lista_productos con ProductoId desde la factura original
    const listaProductos = await this._loadItemsOriginalesAsFacturaItems(
      orig.id,
    );

    return this.facturas.crearYEmitir({
      emisor_id: dto.emisor_id,
      referencia_interna,
      ...receptor,
      factura_tipo,
      punto_venta,

      tipo_comprobante_original: Number(orig.factura_tipo),
      pto_venta_original: Number(orig.punto_venta),
      nro_comprobante_original: Number(orig.nro_comprobante),
      cuit_receptor_comprobante_original:
        dto.cuit_receptor_comprobante_original ?? undefined,

      concepto: 1,
      moneda: dto.moneda ?? 'PES',
      cotizacion: dto.cotizacion ?? 1,

      // ✅ acá va la lista reconstruida (no dto.lista_productos)
      lista_productos: listaProductos,

      test: dto.test ?? undefined,
      codigo_operacion_exento: dto.codigo_operacion_exento ?? ' ',
    });
  }
}

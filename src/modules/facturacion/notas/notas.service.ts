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

    // Inferencias por defecto
    const factura_tipo =
      dto.factura_tipo ?? this._inferTipoNota(true, Number(orig.factura_tipo));
    const punto_venta = dto.punto_venta ?? Number(orig.punto_venta);

    // Receptor: si no viene, usar el de la original
    const receptor = {
      razon_social_receptor:
        dto.razon_social_receptor ?? orig.razon_social_receptor ?? null,
      doc_tipo: dto.doc_tipo ?? Number(orig.doc_tipo ?? 99),
      doc_nro: dto.doc_nro ?? Number(orig.doc_nro ?? 0),
      cond_iva_receptor:
        dto.cond_iva_receptor ?? Number(orig.cond_iva_receptor ?? 5),
    };

    // Idempotencia: si no vino referencia_interna, generamos una base
    const referencia_interna =
      dto.referencia_interna ?? `NC:${orig.id}:${punto_venta}-${factura_tipo}`;

    // Armamos el body que consume el flujo de Etapa 4 (crearYEmitir)
    return this.facturas.crearYEmitir({
      emisor_id: dto.emisor_id,
      referencia_interna,
      ...receptor,
      factura_tipo,
      punto_venta,
      // Encadenamos referencia al original para la API externa
      tipo_comprobante_original: Number(orig.factura_tipo),
      pto_venta_original: Number(orig.punto_venta),
      nro_comprobante_original: Number(orig.nro_comprobante),
      cuit_receptor_comprobante_original:
        dto.cuit_receptor_comprobante_original ?? undefined,
      concepto: 1,
      moneda: dto.moneda ?? 'PES',
      cotizacion: dto.cotizacion ?? 1,
      lista_productos: dto.lista_productos,
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
      lista_productos: dto.lista_productos,
      test: dto.test ?? undefined,
      codigo_operacion_exento: dto.codigo_operacion_exento ?? ' ',
    });
  }
}

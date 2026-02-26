import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiLoggerService } from '../services/api-logger.service';
import { FacturacionConfig } from '../facturacion.config';
import { buildIdempotencyKey, sleep } from '../utils/idempotency.util';

export type Endpoint =
  | '/certificados'
  | '/facturas'
  | '/liquidaciones'
  | '/compras'
  | '/consultar-condicion-iva';



   export type CondicionIVAIn = {
     cuit_consulta: number;
     cuit_computador: number;
     cuit_representado: number;
   };

   export type CondicionIVAOut = {
     consulta: number;
     condicion_iva: string;
   };

@Injectable()
export class FactuExternalClient {
  private http: AxiosInstance;

  constructor(
    private readonly cfg: FacturacionConfig,
    private readonly logger: ApiLoggerService,
  ) {
    this.http = axios.create({
      baseURL: this.cfg.baseUrl,
      timeout: this.cfg.timeoutMs,
      headers: { 'Content-Type': 'application/json' },
      // validateStatus: (s) => s >= 200 && s < 500, // si querés capturar 4xx como respuesta
    });
  }

  // --- Endpoints públicos -----------------------------------------------------

  postCertificados(
    payload: any,
    opts?: { emisor_id?: string; idempotencyKey?: string },
  ) {
    return this.post('/certificados', payload, {
      ...opts,
      documento_tipo: undefined,
    });
  }

  postFacturas(
    payload: any,
    opts?: {
      emisor_id?: string;
      idempotencyKey?: string;
      documento_id?: string;
    },
  ) {
    return this.post('/facturas', payload, {
      ...opts,
      documento_tipo: 'FACTURA',
    });
  }

  postLiquidaciones(
    payload: any,
    opts?: {
      emisor_id?: string;
      idempotencyKey?: string;
      documento_id?: string;
    },
  ) {
    return this.post('/liquidaciones', payload, {
      ...opts,
      documento_tipo: 'LIQ',
    });
  }

  postCompras(
    payload: any,
    opts?: {
      emisor_id?: string;
      idempotencyKey?: string;
      documento_id?: string;
    },
  ) {
    return this.post('/compras', payload, {
      ...opts,
      documento_tipo: 'COMPRA',
    });
  }

  postConsultarCondicionIva(
    payload: CondicionIVAIn,
    opts?: { emisor_id?: string; idempotencyKey?: string },
  ): Promise<CondicionIVAOut> {
    return this.post('/consultar-condicion-iva', payload, {
      ...opts,
      documento_tipo: undefined,
    });
  }

  // --- Core -------------------------------------------------------------------

  private async post(
    endpoint: Endpoint,
    body: any,
    meta?: {
      emisor_id?: string;
      documento_tipo?: 'FACTURA' | 'LIQ' | 'COMPRA';
      documento_id?: string;
      idempotencyKey?: string;
    },
  ) {
    const idemKey =
      meta?.idempotencyKey ?? buildIdempotencyKey({ endpoint, body });

    const headers: Record<string, string> = {};
    if (this.cfg.apiKeyValue)
      headers[this.cfg.apiKeyHeader] = this.cfg.apiKeyValue;
    if (this.cfg.idemHeader) headers[this.cfg.idemHeader] = idemKey;

    const req: AxiosRequestConfig = {
      method: 'POST',
      url: endpoint,
      data: body,
      headers,
    };

    let lastErr: any = null;
    const attempts = Math.max(1, this.cfg.retries + 1);

    for (let i = 1; i <= attempts; i++) {
      try {
        const res = await this.http.request(req);

        // Log OK
        await this.logger.log({
          emisor_id: meta?.emisor_id,
          endpoint: endpoint as any,
          request_payload: this.cfg.logBodies ? body : undefined,
          response_payload: this.cfg.logBodies ? res.data : undefined,
          status_http: res.status,
          ok: true,
          documento_tipo: meta?.documento_tipo ?? null,
          documento_id: meta?.documento_id ?? null,
          idempotency_key: idemKey,
        });

        return res.data;
      } catch (e: any) {
        lastErr = e;
        const status = e?.response?.status ?? null;
        const resp = e?.response?.data ?? e?.message;

        // Log error del intento
        await this.logger.log({
          emisor_id: meta?.emisor_id,
          endpoint: endpoint as any,
          request_payload: this.cfg.logBodies ? body : undefined,
          response_payload: this.cfg.logBodies ? resp : undefined,
          status_http: status,
          ok: false,
          error_msg: typeof resp === 'string' ? resp : JSON.stringify(resp),
          documento_tipo: meta?.documento_tipo ?? null,
          documento_id: meta?.documento_id ?? null,
          idempotency_key: idemKey,
        });

        // backoff si hay más intentos
        if (i < attempts) await sleep(this.cfg.backoffMs);
      }
    }

    // Escalar como 400 para flujo de negocio si viene 4xx, o 502 genérico
    const msg =
      lastErr?.response?.data?.message ||
      lastErr?.response?.data?.detail ||
      lastErr?.message ||
      'Error llamando al servicio de facturación';
    throw new BadRequestException(msg);
  }
}

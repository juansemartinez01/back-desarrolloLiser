import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type LogArgs = {
  emisor_id?: string | null;
  endpoint: '/certificados' | '/facturas' | '/liquidaciones' | '/compras';
  request_payload?: any;
  response_payload?: any;
  status_http?: number | null;
  ok?: boolean | null;
  error_msg?: string | null;
  documento_tipo?: 'FACTURA' | 'LIQ' | 'COMPRA' | null;
  documento_id?: string | null;
  idempotency_key?: string | null;
};

@Injectable()
export class ApiLoggerService {
  constructor(private readonly ds: DataSource) {}

  async log(args: LogArgs) {
    try {
      await this.ds.query(
        `
        INSERT INTO public.fac_api_calls
          (emisor_id, endpoint, request_payload, response_payload, status_http, ok, error_msg,
           documento_tipo, documento_id, idempotency_key)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
        [
          args.emisor_id ?? null,
          args.endpoint,
          args.request_payload ?? null,
          args.response_payload ?? null,
          args.status_http ?? null,
          args.ok ?? null,
          args.error_msg ?? null,
          args.documento_tipo ?? null,
          args.documento_id ?? null,
          args.idempotency_key ?? null,
        ],
      );
    } catch {
      // no tirar la app por fallas de logging
    }
  }
}

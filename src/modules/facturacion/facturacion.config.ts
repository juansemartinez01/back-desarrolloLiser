import { Injectable } from '@nestjs/common';

@Injectable()
export class FacturacionConfig {
  // URL base del servicio externo (FastAPI/ARCA-proxy)
  readonly baseUrl = process.env.FACT_EXT_BASE_URL ?? 'http://localhost:8000';

  // Header opcional de API key (si lo usás en ese servicio)
  readonly apiKeyHeader = process.env.FACT_EXT_APIKEY_HEADER ?? 'X-API-Key';
  readonly apiKeyValue = process.env.FACT_EXT_APIKEY_VALUE ?? '';

  // Timeouts/reintentos
  readonly timeoutMs = Number(process.env.FACT_EXT_TIMEOUT_MS ?? 15000);
  readonly retries = Number(process.env.FACT_EXT_RETRIES ?? 1);
  readonly backoffMs = Number(process.env.FACT_EXT_BACKOFF_MS ?? 400);

  // Enviar/propagar Idempotency-Key por header
  readonly idemHeader = process.env.FACT_EXT_IDEM_HEADER ?? 'Idempotency-Key';

  // Encendido de logging crudo (request/response)
  readonly logBodies = (process.env.FACT_EXT_LOG_BODIES ?? 'true') === 'true';
}

import * as crypto from 'crypto';

export function buildIdempotencyKey(input: unknown): string {
  // Hash estable: cuerpo + clase de endpoint opcional
  const str = typeof input === 'string' ? input : JSON.stringify(input ?? {});
  const h = crypto.createHash('sha256').update(str).digest('hex'); // 64 chars
  // devolvemos 64 (o cortá a 80 si mezclás metadatos). Nuestra columna admite 80.
  return h; // length 64
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

import type { NextRequest } from 'next/server';

/**
 * Proteções básicas para endpoints públicos.
 *
 * ATENÇÃO: o rate limit abaixo é em memória, ou seja, por instância serverless.
 * Serve para desenvolvimento e para barrar abuso trivial. Em produção com
 * tráfego real, troque por um store compartilhado (Vercel KV / Upstash Redis),
 * senão cada instância nova reinicia a contagem.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Limpa buckets expirados para o Map não crescer indefinidamente. */
function sweep() {
  if (buckets.size < 5_000) return;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  sweep();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= limit;
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Honeypot: o form renderiza um campo escondido que humano não preenche.
 * Se veio com valor, é bot.
 */
export const HONEYPOT_FIELD = 'website_url';

export function honeypotTripped(raw: any): boolean {
  return typeof raw?.[HONEYPOT_FIELD] === 'string' && raw[HONEYPOT_FIELD].length > 0;
}

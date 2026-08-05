import type { FareProvider } from '@/lib/types';
import { ignavProvider } from './ignav';
import { mockProvider } from './mock';

/**
 * Único ponto que decide de onde vêm as tarifas.
 *
 * Com IGNAV_API_KEY configurada, usa a API real. Sem ela, cai no stub offline
 * para o projeto continuar rodando em desenvolvimento — nunca silenciosamente:
 * a rota de API loga o aviso e o report carrega `meta.source`.
 */
export function getFareProvider(): FareProvider {
  if (process.env.IGNAV_API_KEY) return ignavProvider;

  console.warn(
    '[fares] IGNAV_API_KEY ausente — usando stub offline. Os preços NÃO são reais.',
  );
  return mockProvider;
}

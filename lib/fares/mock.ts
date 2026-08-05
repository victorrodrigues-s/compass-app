import type { Airport, FareProvider, FareQuote } from '@/lib/types';
import { ONFLY_DISCOUNT_PERCENT } from './ignav';

/**
 * Fallback offline — usado APENAS quando IGNAV_API_KEY não está configurada.
 *
 * Existe para o projeto rodar em `npm run dev` sem credencial, não para servir
 * usuário real. Quando ele entra em ação, o report vem marcado com
 * `meta.source = 'mock'` e a rota loga um aviso.
 */

const AIRPORTS: Airport[] = [
  { code: 'CGH', name: 'Congonhas', city: 'São Paulo', country: 'Brasil' },
  { code: 'GRU', name: 'Guarulhos', city: 'São Paulo', country: 'Brasil' },
  { code: 'SDU', name: 'Santos Dumont', city: 'Rio de Janeiro', country: 'Brasil' },
  { code: 'GIG', name: 'Galeão', city: 'Rio de Janeiro', country: 'Brasil' },
  { code: 'CNF', name: 'Confins', city: 'Belo Horizonte', country: 'Brasil' },
  { code: 'BSB', name: 'Presidente Juscelino Kubitschek', city: 'Brasília', country: 'Brasil' },
  { code: 'POA', name: 'Salgado Filho', city: 'Porto Alegre', country: 'Brasil' },
  { code: 'REC', name: 'Guararapes', city: 'Recife', country: 'Brasil' },
  { code: 'SSA', name: 'Deputado Luís Eduardo Magalhães', city: 'Salvador', country: 'Brasil' },
  { code: 'CWB', name: 'Afonso Pena', city: 'Curitiba', country: 'Brasil' },
];

/** Preço pseudo-aleatório porém estável para o mesmo par de aeroportos. */
function stubFareCents(origin: string, destination: string): number {
  const seed = [...`${origin}${destination}`].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 60000 + (seed % 120) * 1000; // R$ 600 a R$ 1.790
}

/**
 * Remove acentos para comparar. Ninguém digita "São" num campo de busca, então
 * "sao paulo" precisa casar com "São Paulo".
 */
function normalize(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export const mockProvider: FareProvider = {
  name: 'mock',

  async searchAirports(query) {
    const q = normalize(query.trim());
    if (q.length < 3) return [];
    return AIRPORTS.filter(
      (a) =>
        normalize(a.code).includes(q) ||
        normalize(a.city).includes(q) ||
        normalize(a.name).includes(q),
    ).slice(0, 8);
  },

  async getQuote(originCode, destinationCode) {
    const origin = AIRPORTS.find((a) => a.code === originCode);
    const destination = AIRPORTS.find((a) => a.code === destinationCode);
    if (!origin || !destination) return null;

    const marketFareCents = stubFareCents(originCode, destinationCode);

    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 21);

    return {
      origin,
      destination,
      marketFareCents,
      onflyFareCents: Math.round(marketFareCents * (1 - ONFLY_DISCOUNT_PERCENT / 100)),
      currency: 'BRL',
      discountPercent: ONFLY_DISCOUNT_PERCENT,
      departureDate: d.toISOString().slice(0, 10),
      carrier: null,
      priceStatus: 'unverified',
    } satisfies FareQuote;
  },
};

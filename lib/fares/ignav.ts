import type { Airport, FareProvider, FareQuote } from '@/lib/types';

/**
 * Fonte real de tarifas: API pública da Ignav (https://ignav.com/docs).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTROLE DE CUSTO — leia antes de mexer
 * ─────────────────────────────────────────────────────────────────────────────
 * A Ignav cobra por requisição bem-sucedida. Esta é uma LP pública ligada a
 * tráfego pago, então SEM cache cada visitante (e cada tecla no autocomplete)
 * vira dinheiro. Três defesas, todas necessárias:
 *
 *   1. Cache em memória por trecho (12h) e por termo de busca (24h).
 *   2. O componente de busca faz debounce e exige 3+ caracteres.
 *   3. Rate limit por IP nas rotas de API (lib/guard.ts).
 *
 * Mesmo assim, o cache é POR INSTÂNCIA serverless. Com volume real, mova para
 * Vercel KV / Upstash Redis, senão cada instância nova recomeça do zero.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BASE_URL = 'https://ignav.com';

/**
 * Desconto aplicado sobre a tarifa de mercado para chegar ao "valor Onfly".
 *
 * IMPORTANTE: este número é uma PREMISSA COMERCIAL, não um preço medido.
 * O report precisa apresentá-lo como tal — ver o rodapé de procedência.
 */
export const ONFLY_DISCOUNT_PERCENT = Number(process.env.ONFLY_DISCOUNT_PERCENT ?? '8.9');

/** Mercado usado na busca. Define a moeda e a precificação regional. */
const MARKET = process.env.IGNAV_MARKET ?? 'BR';

/**
 * Antecedência da pesquisa, em dias.
 *
 * Precisa ser fixa: se a data variasse a cada visita, dois usuários no mesmo
 * trecho veriam números diferentes e o cache nunca acertaria. 21 dias é uma
 * antecedência corporativa realista.
 */
const SEARCH_LEAD_DAYS = Number(process.env.IGNAV_LEAD_DAYS ?? '21');

const QUOTE_TTL_MS = 1000 * 60 * 60 * 12; // 12h
/** TTL curto para "sem voo encontrado" — não gruda esse resultado por 12h se foi transitório. */
const EMPTY_RESULT_TTL_MS = 1000 * 60 * 5; // 5min
const AIRPORT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

type CacheEntry<T> = { value: T; expiresAt: number };
const quoteCache = new Map<string, CacheEntry<FareQuote | null>>();
const airportCache = new Map<string, CacheEntry<Airport[]>>();

function fresh<T>(e: CacheEntry<T> | undefined): e is CacheEntry<T> {
  return !!e && e.expiresAt > Date.now();
}

/** Evita o Map crescer sem limite em instâncias de vida longa. */
function sweep(map: Map<string, CacheEntry<unknown>>) {
  if (map.size < 2000) return;
  const now = Date.now();
  for (const [k, v] of map) if (v.expiresAt <= now) map.delete(k);
}

/** Data de pesquisa: hoje + lead, sempre em dia útil (evita tarifa de fim de semana). */
function searchDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + SEARCH_LEAD_DAYS);
  // 0 = domingo, 6 = sábado -> empurra para segunda
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().slice(0, 10);
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const key = process.env.IGNAV_API_KEY;
  if (!key) throw new Error('IGNAV_API_KEY ausente');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': key,
      ...(init.headers ?? {}),
    },
    // Timeout: a LP não pode ficar pendurada esperando fornecedor externo.
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[ignav] resposta não-OK', { path, status: res.status, body: body.slice(0, 300) });
    throw new Error(`Ignav respondeu ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const ignavProvider: FareProvider = {
  name: 'ignav',

  async searchAirports(query) {
    const q = query.trim();
    if (q.length < 3) return [];

    const cacheKey = q.toLowerCase();
    const cached = airportCache.get(cacheKey);
    if (fresh(cached)) return cached.value;

    const rows = await call<Airport[]>(
      `/api/airports?q=${encodeURIComponent(q)}&limit=8`,
      { method: 'GET' },
    );

    const airports = rows.map((r) => ({
      code: r.code,
      name: r.name,
      city: r.city,
      country: r.country,
    }));

    sweep(airportCache);
    airportCache.set(cacheKey, { value: airports, expiresAt: Date.now() + AIRPORT_TTL_MS });
    return airports;
  },

  async getQuote(originCode, destinationCode) {
    const departureDate = searchDate();
    const cacheKey = `${originCode}-${destinationCode}-${departureDate}`;

    const cached = quoteCache.get(cacheKey);
    if (fresh(cached)) return cached.value;

    type Resp = {
      origin: string;
      destination: string;
      departure_date: string;
      itineraries: {
        price: { amount: number; currency: string; status: 'verified' | 'unverified' };
        outbound: { carrier: string | null };
      }[];
    };

    const data = await call<Resp>('/api/fares/one-way', {
      method: 'POST',
      body: JSON.stringify({
        origin: originCode,
        destination: destinationCode,
        departure_date: departureDate,
        cabin_class: 'economy',
        market: MARKET,
        // Viagem corporativa: conexão dupla não é comparável a um voo direto.
        max_stops: 1,
        // Autotransferência exige o passageiro reembarcar por conta própria.
        allow_self_transfer: false,
      }),
    });

    // A API não garante ordenação por preço, então escolhemos o menor.
    const cheapest = data.itineraries?.reduce(
      (min, it) => (min === null || it.price.amount < min.price.amount ? it : min),
      null as Resp['itineraries'][number] | null,
    );

    let value: FareQuote | null = null;

    if (cheapest) {
      // Centavos como inteiro: dinheiro nunca em ponto flutuante.
      const marketFareCents = Math.round(cheapest.price.amount * 100);
      const onflyFareCents = Math.round(marketFareCents * (1 - ONFLY_DISCOUNT_PERCENT / 100));

      value = {
        // Os objetos Airport completos são preenchidos pela rota de API, que
        // já tem os dados da busca — evita duas chamadas extras aqui.
        origin: { code: data.origin, name: '', city: '', country: '' },
        destination: { code: data.destination, name: '', city: '', country: '' },
        marketFareCents,
        onflyFareCents,
        currency: cheapest.price.currency,
        discountPercent: ONFLY_DISCOUNT_PERCENT,
        departureDate: data.departure_date,
        carrier: cheapest.outbound?.carrier ?? null,
        priceStatus: cheapest.price.status,
      };
    } else {
      // Não é erro — a Ignav respondeu OK, só não tem voo para esse par na
      // data pesquisada. Logamos mesmo assim: sem isso, esse caso é invisível
      // nos logs da Vercel e vira "não sei por que aconteceu" na hora de
      // investigar.
      console.warn('[ignav] busca sem itinerários', {
        originCode,
        destinationCode,
        departureDate,
        itinerariesCount: data.itineraries?.length ?? 0,
      });
    }

    sweep(quoteCache);
    // Resultado vazio fica em cache por menos tempo que um preço real: se foi
    // um blip pontual da Ignav, a próxima pessoa buscando o mesmo trecho não
    // deveria ficar presa a esse "sem voo" por 12h inteiras.
    const ttl = value ? QUOTE_TTL_MS : EMPTY_RESULT_TTL_MS;
    quoteCache.set(cacheKey, { value, expiresAt: Date.now() + ttl });
    return value;
  },
};

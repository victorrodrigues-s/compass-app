/**
 * Contrato de dados único do Compass.
 *
 *   1. Quiz          -> QuizAnswers
 *   2. Fonte de tarifas -> FareQuote  (Ignav)
 *   3. Report        -> CompassReport
 *
 * Só existe UM formulário no HubSpot (HUBSPOT_FORM_ID_STEP1). Os cliques em
 * "falar com especialista" e "testar grátis" reenviam para ele — o HubSpot
 * casa pelo e-mail e atualiza o mesmo contato, não cria um novo.
 */

// ---------------------------------------------------------------------------
// 1. Aeroportos e tarifas
// ---------------------------------------------------------------------------

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
}

export interface FareQuote {
  origin: Airport;
  destination: Airport;
  marketFareCents: number;
  onflyFareCents: number;
  currency: string;
  discountPercent: number;
  departureDate: string;
  carrier: string | null;
  priceStatus: 'verified' | 'unverified';
}

export interface FareProvider {
  readonly name: 'ignav' | 'mock';
  searchAirports(query: string): Promise<Airport[]>;
  getQuote(originCode: string, destinationCode: string): Promise<FareQuote | null>;
}

// ---------------------------------------------------------------------------
// 2. Quiz
// ---------------------------------------------------------------------------

export type BookingMethod = 'agencia' | 'direto' | 'plataforma' | 'misto';
export type TripVolumeBand = '1-10' | '11-30' | '31-80' | '80+';

/**
 * usa_alguma_agncia_de_viagem_ e quantas_viagens_sua_empresa_faz_por_ms são
 * campos de TEXTO LIVRE no HubSpot (confirmado via API — não são dropdown).
 * Por isso mandamos texto legível em vez do código interno ('direto', '1-10').
 */
export const BOOKING_METHOD_LABELS: Record<BookingMethod, string> = {
  agencia: 'Por uma agência de viagens',
  direto: 'Direto no site de cada fornecedor',
  plataforma: 'Em uma plataforma de gestão',
  misto: 'Depende de quem está viajando',
};

export const TRIP_VOLUME_LABELS: Record<TripVolumeBand, string> = {
  '1-10': 'Até 10 viagens por mês',
  '11-30': '11 a 30 viagens por mês',
  '31-80': '31 a 80 viagens por mês',
  '80+': 'Mais de 80 viagens por mês',
};

/**
 * Dor principal. 'comparar' é distinta de 'tempo': 'tempo' é sobre o processo
 * de reserva como um todo, 'comparar' é especificamente sobre a fadiga de
 * pesquisar preço em vários lugares antes de decidir.
 */
export type MainPain = 'preco' | 'tempo' | 'reembolso' | 'controle' | 'comparar';

/**
 * Faixas de gasto mensal com viagens.
 *
 * ATENÇÃO: precisam bater EXATAMENTE com as opções da propriedade no HubSpot
 * — inclusive o "milhão" no singular na penúltima opção. Não é erro de
 * digitação meu: é o texto exato que já existe no formulário de vocês.
 */
export type MonthlySpendBand =
  | 'Até 10 mil reais/mês'
  | 'De 10 a 30 mil reais/mês'
  | 'De 30 a 100 mil reais/mês'
  | 'De 100 a 500 mil reais/mês'
  | 'De 500 mil a 1 milhão de reais/mês'
  | 'Mais de 1 milhão de reais/mês';

export const MONTHLY_SPEND_OPTIONS: MonthlySpendBand[] = [
  'Até 10 mil reais/mês',
  'De 10 a 30 mil reais/mês',
  'De 30 a 100 mil reais/mês',
  'De 100 a 500 mil reais/mês',
  'De 500 mil a 1 milhão de reais/mês',
  'Mais de 1 milhão de reais/mês',
];

/** Abaixo desta faixa, o report só oferece o caminho de teste gratuito. */
export const TRIAL_ONLY_SPEND: MonthlySpendBand = 'Até 10 mil reais/mês';

/**
 * Canais de origem — lista real, tirada do dropdown já existente no HubSpot.
 * MESMA RESSALVA: precisa bater exatamente com a propriedade de lá.
 */
/**
 * Confirmado via API do HubSpot (propriedade self_attribution_message) em
 * 05/08/2026 — não é mais um palpite tirado de print. O rótulo é o que a
 * pessoa vê no select; o valor é o que precisa ser enviado, e em vários
 * casos eles DIVERGEM (ex.: rótulo "Aeroporto & Outdoor", valor "Aeroporto").
 * Nunca use o rótulo como valor enviado.
 */
export const HOW_HEARD_OPTIONS: { value: string; label: string }[] = [
  { value: 'Aeroporto', label: 'Aeroporto & Outdoor' },
  { value: 'Blog e Conteúdos Onfly', label: 'Blog e Conteúdos Onfly' },
  { value: 'Cinema', label: 'Cinema' },
  { value: 'Elevador comercial', label: 'Elevador comercial' },
  { value: 'Empresa Parceira', label: 'Empresa Parceira' },
  { value: 'Evento', label: 'Evento' },
  { value: 'Google', label: 'Google' },
  { value: 'Indicação', label: 'Indicação' },
  { value: 'Influênciador', label: 'Influenciador' },
  { value: 'Instagram/Facebook', label: 'Instagram/Facebook/Tiktok' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Imprensa/Sites de notícia', label: 'Podcast/Imprensa/Sites de notícia' },
  { value: 'Anúncio do Spotify', label: 'Spotify & Rádio' },
  { value: 'Taxi & Uber', label: 'Taxi & Uber' },
  { value: 'TV', label: 'TV & Streaming' },
  { value: 'TV de Bordo Azul', label: 'TV de Bordo Azul' },
  { value: 'Um vendedor me abordou', label: 'Um vendedor me abordou' },
  { value: 'YouTube', label: 'YouTube' },
  { value: 'Outros', label: 'Outros' },
];

export type HowHeard = string;

export interface QuizAnswers {
  originCode: string;
  destinationCode: string;

  /** Mapeado para a propriedade "company", já existente no HubSpot. */
  companyName: string;

  tripVolume: TripVolumeBand;
  bookingMethod: BookingMethod;
  mainPain: MainPain;
  monthlySpend: MonthlySpendBand;
  howHeard: HowHeard;

  firstName: string;
  email: string;
  phone: string;

  consent: boolean;
}

// ---------------------------------------------------------------------------
// 3. Report
// ---------------------------------------------------------------------------

export interface ComparisonRow {
  label: string;
  today: string;
  onfly: string;
  highlight?: boolean;
}

export interface Pillar {
  n: string;
  title: string;
  body: string;
  chip: string;
}

export interface CompassReport {
  user: { firstName: string };

  quote: {
    routeLabel: string;
    originCode: string;
    destinationCode: string;
    rows: ComparisonRow[];
    savingsPerTripCents: number;
    currency: string;
    discountPercent: number;
    carrier: string | null;
    departureDate: string;
  };

  projection: {
    annualSavingsCents: number;
    tripsPerYear: number;
    hoursSavedPerYear: number;
  };

  pillars: Pillar[];

  meta: {
    source: 'ignav' | 'mock';
    unverifiedPrice: boolean;
    generatedAt: string;
  };
}

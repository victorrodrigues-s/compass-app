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
export const HOW_HEARD_OPTIONS = [
  'Aeroporto & Outdoor',
  'Blog e Conteúdos Onfly',
  'Cinema',
  'Elevador comercial',
  'Empresa Parceira',
  'Evento',
  'Google',
  'Indicação',
  'Influenciador',
  'Instagram/Facebook/Tiktok',
  'LinkedIn',
  'Podcast/Imprensa/Sites de notícia',
  'Spotify & Rádio',
  'Taxi & Uber',
  'TV & Streaming',
  'TV de Bordo Azul',
  'Um vendedor me abordou',
  'YouTube',
  'Outros',
] as const;

export type HowHeard = (typeof HOW_HEARD_OPTIONS)[number];

export interface QuizAnswers {
  originCode: string;
  destinationCode: string;

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

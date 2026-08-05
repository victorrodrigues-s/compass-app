import type {
  BookingMethod,
  CompassReport,
  ComparisonRow,
  FareQuote,
  MainPain,
  Pillar,
  QuizAnswers,
  TripVolumeBand,
} from '@/lib/types';

/**
 * Regra de negócio do Compass: cotação real + respostas do quiz -> JSON do report.
 * Constantes nomeadas e agrupadas aqui — para o comercial recalibrar sem mexer em UI.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de negócio — CALIBRAR COM O TIME COMERCIAL
// ─────────────────────────────────────────────────────────────────────────────

const TRIPS_PER_MONTH: Record<TripVolumeBand, number> = {
  '1-10': 5,
  '11-30': 20,
  '31-80': 55,
  '80+': 100,
};

/** Premissas de tempo de reserva — a API de tarifas não fornece esse dado. */
const BOOKING_MINUTES_TODAY = 43;
const BOOKING_MINUTES_ONFLY = 3;

const FRICTION_FACTOR: Record<BookingMethod, number> = {
  direto: 1.25,
  agencia: 1.0,
  misto: 1.15,
  plataforma: 0.75,
};

const OPERATIONAL_HOURLY_COST_CENTS = 6500; // 65,00

// ─────────────────────────────────────────────────────────────────────────────
// Formatação
// ─────────────────────────────────────────────────────────────────────────────

export function formatMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabela comparativa
// ─────────────────────────────────────────────────────────────────────────────

const TODAY_BY_METHOD: Record<BookingMethod, { approval: string; expense: string; suppliers: string }> = {
  agencia: {
    approval: 'E-mail e WhatsApp com o gestor',
    expense: 'Planilha enviada no fim do mês',
    suppliers: 'O que a agência oferecer',
  },
  direto: {
    approval: 'Aprovação verbal, sem registro',
    expense: 'Notas fiscais em papel',
    suppliers: 'Um site por vez',
  },
  plataforma: {
    approval: 'Aprovação na plataforma atual',
    expense: 'Exportação manual para o financeiro',
    suppliers: 'O catálogo da plataforma atual',
  },
  misto: {
    approval: 'Depende de quem está reservando',
    expense: 'Cada um envia de um jeito',
    suppliers: 'Depende de quem está reservando',
  },
};

function buildRows(quote: FareQuote, answers: QuizAnswers): ComparisonRow[] {
  const today = TODAY_BY_METHOD[answers.bookingMethod];
  const minutesToday = BOOKING_MINUTES_TODAY * FRICTION_FACTOR[answers.bookingMethod];

  return [
    {
      label: 'Preço da passagem',
      today: formatMoney(quote.marketFareCents, quote.currency),
      onfly: formatMoney(quote.onflyFareCents, quote.currency),
      highlight: true,
    },
    {
      label: 'Tempo para fechar a reserva',
      today: formatMinutes(minutesToday),
      onfly: formatMinutes(BOOKING_MINUTES_ONFLY),
      highlight: answers.mainPain === 'tempo' || answers.mainPain === 'comparar',
    },
    {
      label: 'Fornecedores consultados',
      today: today.suppliers,
      onfly: 'Todo o mercado em uma busca',
      highlight: answers.mainPain === 'comparar',
    },
    {
      label: 'Aprovação da viagem',
      today: today.approval,
      onfly: 'Fluxo automático por política',
      highlight: answers.mainPain === 'controle',
    },
    {
      label: 'Prestação de contas',
      today: today.expense,
      onfly: 'Despesa conciliada na hora',
      highlight: answers.mainPain === 'reembolso',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pilares — ordenados pela dor declarada
// ─────────────────────────────────────────────────────────────────────────────

const PILLAR_LIBRARY: Record<MainPain, Omit<Pillar, 'n'>> = {
  preco: {
    title: 'Busca única, mercado inteiro',
    body: 'Todos os fornecedores de viagem corporativa em uma só busca. O menor preço disponível aparece na tela em minutos, sem abrir cinco abas nem esperar retorno de agência.',
    chip: 'Menor tarifa disponível',
  },
  tempo: {
    title: 'Reserva em minutos, não em dias',
    body: 'O viajante escolhe, a política valida e a reserva sai — sem fila de e-mail. O tempo que hoje vai para cotação volta para o trabalho que realmente importa.',
    chip: 'Reserva em até 3 minutos',
  },
  comparar: {
    title: 'Uma busca só, sem virar garimpeiro de tarifa',
    body: 'A Onfly varre o mercado inteiro numa única busca e já mostra a melhor opção. Ninguém do seu time precisa abrir dez abas comparando preço fornecedor por fornecedor.',
    chip: 'Comparação automática de tarifas',
  },
  reembolso: {
    title: 'Reembolso sem planilha',
    body: 'A despesa entra pelo app com foto da nota e cai conciliada no financeiro. Nada de guardar notinha no bolso nem esperar o fechamento do mês.',
    chip: 'Prestação de contas automática',
  },
  controle: {
    title: 'Política que se aplica sozinha',
    body: 'Você define os limites uma vez e a plataforma aplica em toda reserva. Aprovação deixa de ser conversa e passa a ser regra, com registro de cada decisão.',
    chip: 'Política aplicada na origem',
  },
};

function buildPillars(answers: QuizAnswers): Pillar[] {
  const order: MainPain[] = ['preco', 'tempo', 'comparar', 'reembolso', 'controle'];
  const rest = order.filter((p) => p !== answers.mainPain).slice(0, 2);

  return [answers.mainPain, ...rest].map((pain, i) => ({
    ...PILLAR_LIBRARY[pain],
    n: String(i + 1).padStart(2, '0'),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Montagem do report
// ─────────────────────────────────────────────────────────────────────────────

export function buildCompassReport(input: {
  answers: QuizAnswers;
  quote: FareQuote;
  source: 'ignav' | 'mock';
}): CompassReport {
  const { answers, quote, source } = input;

  const savingsPerTripCents = Math.max(0, quote.marketFareCents - quote.onflyFareCents);
  const tripsPerYear = TRIPS_PER_MONTH[answers.tripVolume] * 12;

  const minutesSavedPerTrip = Math.max(
    0,
    BOOKING_MINUTES_TODAY * FRICTION_FACTOR[answers.bookingMethod] - BOOKING_MINUTES_ONFLY,
  );
  const hoursSavedPerYear = Math.round((minutesSavedPerTrip * tripsPerYear) / 60);

  const fareSavings = savingsPerTripCents * tripsPerYear;
  const timeSavings = hoursSavedPerYear * OPERATIONAL_HOURLY_COST_CENTS;

  const label = (a: typeof quote.origin) => (a.city ? `${a.city} (${a.code})` : a.code);

  return {
    user: { firstName: answers.firstName },
    quote: {
      routeLabel: `${label(quote.origin)} › ${label(quote.destination)}`,
      originCode: quote.origin.code,
      destinationCode: quote.destination.code,
      rows: buildRows(quote, answers),
      savingsPerTripCents,
      currency: quote.currency,
      discountPercent: quote.discountPercent,
      carrier: quote.carrier,
      departureDate: quote.departureDate,
    },
    projection: {
      annualSavingsCents: fareSavings + timeSavings,
      tripsPerYear,
      hoursSavedPerYear,
    },
    pillars: buildPillars(answers),
    meta: {
      source,
      unverifiedPrice: quote.priceStatus !== 'verified',
      generatedAt: new Date().toISOString(),
    },
  };
}

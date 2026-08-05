import { NextRequest, NextResponse } from 'next/server';
import { getFareProvider } from '@/lib/fares';
import { buildCompassReport } from '@/lib/compass';
import { submitStep1 } from '@/lib/hubspot';
import { checkRateLimit, clientIp, honeypotTripped } from '@/lib/guard';
import { isValidEmail, isValidPhone } from '@/lib/validation';
import {
  HOW_HEARD_OPTIONS,
  MONTHLY_SPEND_OPTIONS,
  type BookingMethod,
  type MainPain,
  type QuizAnswers,
  type TripVolumeBand,
} from '@/lib/types';

/**
 * POST /api/compass
 *
 * Única porta de entrada para a camada de dados. O browser nunca fala com a
 * Ignav nem com o HubSpot direto.
 *
 *   1. valida a entrada (todo o quiz, já que a rota vem no fim do fluxo agora)
 *   2. busca a tarifa real do trecho e monta o report
 *   3. dispara o único formulário do HubSpot (falha aqui não bloqueia o resultado)
 */

export const runtime = 'nodejs';

const VALID_VOLUMES: TripVolumeBand[] = ['1-10', '11-30', '31-80', '80+'];
const VALID_METHODS: BookingMethod[] = ['agencia', 'direto', 'plataforma', 'misto'];
const VALID_PAINS: MainPain[] = ['preco', 'tempo', 'comparar', 'reembolso', 'controle'];
const IATA_RE = /^[A-Z]{3}$/;

function parseAnswers(raw: any): { answers: QuizAnswers } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Corpo da requisição inválido.' };

  const firstName = String(raw.firstName ?? '').trim();
  const email = String(raw.email ?? '').trim().toLowerCase();
  const phone = String(raw.phone ?? '').trim();

  if (firstName.length < 2) return { error: 'Informe seu nome.' };
  if (!isValidEmail(email)) return { error: 'Informe um e-mail válido.' };
  if (!isValidPhone(phone)) return { error: 'Informe um celular com DDD.' };
  if (raw.consent !== true) return { error: 'É necessário aceitar o uso dos dados para continuar.' };

  if (!VALID_VOLUMES.includes(raw.tripVolume)) return { error: 'Volume de viagens inválido.' };
  if (!VALID_METHODS.includes(raw.bookingMethod)) return { error: 'Método de reserva inválido.' };
  if (!VALID_PAINS.includes(raw.mainPain)) return { error: 'Escolha inválida.' };
  if (!MONTHLY_SPEND_OPTIONS.includes(raw.monthlySpend)) {
    return { error: 'Selecione o gasto médio mensal com viagens.' };
  }
  if (!HOW_HEARD_OPTIONS.includes(raw.howHeard)) {
    return { error: 'Selecione por onde conheceu a Onfly.' };
  }

  const originCode = String(raw.originCode ?? '').trim().toUpperCase();
  const destinationCode = String(raw.destinationCode ?? '').trim().toUpperCase();

  if (!IATA_RE.test(originCode)) return { error: 'Selecione o aeroporto de origem.' };
  if (!IATA_RE.test(destinationCode)) return { error: 'Selecione o aeroporto de destino.' };
  if (originCode === destinationCode) {
    return { error: 'Origem e destino precisam ser diferentes.' };
  }

  return {
    answers: {
      firstName,
      email,
      phone,
      originCode,
      destinationCode,
      tripVolume: raw.tripVolume,
      bookingMethod: raw.bookingMethod,
      mainPain: raw.mainPain,
      monthlySpend: raw.monthlySpend,
      howHeard: raw.howHeard,
      consent: true,
    },
  };
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (!checkRateLimit(`compass:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde um minuto e tente de novo.' },
      { status: 429 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (honeypotTripped(raw)) {
    return NextResponse.json({ error: 'Requisição rejeitada.' }, { status: 400 });
  }

  const parsed = parseAnswers(raw);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { answers } = parsed;

  const provider = getFareProvider();
  let report;
  try {
    const quote = await provider.getQuote(answers.originCode, answers.destinationCode);

    if (!quote) {
      return NextResponse.json(
        {
          error:
            'Não encontramos voos para esse trecho na data pesquisada. Tente outro par de aeroportos.',
        },
        { status: 404 },
      );
    }

    const [origins, destinations] = await Promise.all([
      provider.searchAirports(answers.originCode).catch(() => []),
      provider.searchAirports(answers.destinationCode).catch(() => []),
    ]);
    const originFull = origins.find((a) => a.code === answers.originCode);
    const destinationFull = destinations.find((a) => a.code === answers.destinationCode);

    report = buildCompassReport({
      answers,
      quote: {
        ...quote,
        origin: originFull ?? quote.origin,
        destination: destinationFull ?? quote.destination,
      },
      source: provider.name,
    });
  } catch (err) {
    console.error('[compass] falha ao cotar trecho', err);
    return NextResponse.json(
      { error: 'Não conseguimos consultar as tarifas agora. Tente novamente em instantes.' },
      { status: 503 },
    );
  }

  try {
    await submitStep1(answers, report, {
      hutk: req.cookies.get('hubspotutk')?.value,
      ipAddress: ip,
      pageUri: req.headers.get('referer') ?? undefined,
      pageName: 'Onfly Compass',
    });
  } catch (err) {
    console.error('[compass] submissão ao HubSpot falhou (report entregue de todo modo)', err);
  }

  return NextResponse.json({ report });
}

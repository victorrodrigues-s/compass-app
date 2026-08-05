import {
  HOW_HEARD_OPTIONS,
  MONTHLY_SPEND_OPTIONS,
  type BookingMethod,
  type MonthlySpendBand,
  type TripVolumeBand,
} from '@/lib/types';
import { isValidEmail, isValidPhone } from '@/lib/validation';

/**
 * Validação compartilhada dos campos "base" — os que toda submissão ao
 * HubSpot manda, independente do caminho (quiz completo, especialista,
 * trial). Fica num lugar só porque as três rotas de API precisam da mesma
 * checagem, e divergir entre elas é como o bug dos campos obrigatórios
 * apareceu da primeira vez.
 */

export interface BaseAnswers {
  firstName: string;
  email: string;
  phone: string;
  companyName: string;
  tripVolume: TripVolumeBand;
  bookingMethod: BookingMethod;
  monthlySpend: MonthlySpendBand;
  howHeard: string;
}

const VALID_VOLUMES: TripVolumeBand[] = ['1-10', '11-30', '31-80', '80+'];
const VALID_METHODS: BookingMethod[] = ['agencia', 'direto', 'plataforma', 'misto'];

export function parseBaseAnswers(raw: any): { answers: BaseAnswers } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Corpo da requisição inválido.' };

  const firstName = String(raw.firstName ?? '').trim();
  const email = String(raw.email ?? '').trim().toLowerCase();
  const phone = String(raw.phone ?? '').trim();
  const companyName = String(raw.companyName ?? '').trim();

  if (firstName.length < 2) return { error: 'Informe seu nome.' };
  if (!isValidEmail(email)) return { error: 'Informe um e-mail válido.' };
  if (!isValidPhone(phone)) return { error: 'Informe um celular com DDD.' };
  if (companyName.length < 2) return { error: 'Informe o nome da empresa.' };

  if (!VALID_VOLUMES.includes(raw.tripVolume)) return { error: 'Volume de viagens inválido.' };
  if (!VALID_METHODS.includes(raw.bookingMethod)) return { error: 'Método de reserva inválido.' };
  if (!MONTHLY_SPEND_OPTIONS.includes(raw.monthlySpend)) {
    return { error: 'Gasto mensal inválido.' };
  }
  if (!HOW_HEARD_OPTIONS.some((opt) => opt.value === raw.howHeard)) {
    return { error: 'Como conheceu a Onfly inválido.' };
  }

  return {
    answers: {
      firstName,
      email,
      phone,
      companyName,
      tripVolume: raw.tripVolume,
      bookingMethod: raw.bookingMethod,
      monthlySpend: raw.monthlySpend,
      howHeard: raw.howHeard,
    },
  };
}

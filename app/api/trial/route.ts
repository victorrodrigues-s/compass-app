import { NextRequest, NextResponse } from 'next/server';
import { submitTrialInterest } from '@/lib/hubspot';
import { checkRateLimit, clientIp, honeypotTripped } from '@/lib/guard';
import { parseBaseAnswers } from '@/lib/quiz-validation';
import { cnpjDigits, isValidCnpj } from '@/lib/validation';

/**
 * POST /api/trial
 *
 * CNPJ do "testar grátis" — junto com o conjunto base completo, pelo mesmo
 * motivo do /api/hubspot: campos obrigatórios do formulário são validados em
 * toda submissão ao HubSpot, não só na primeira.
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (!checkRateLimit(`trial:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde um minuto e tente de novo.' },
      { status: 429 },
    );
  }

  let raw: any;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (honeypotTripped(raw)) {
    return NextResponse.json({ error: 'Requisição rejeitada.' }, { status: 400 });
  }

  const parsed = parseBaseAnswers(raw);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const cnpj = String(raw?.cnpj ?? '');
  if (!isValidCnpj(cnpj)) {
    return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 });
  }

  try {
    await submitTrialInterest(parsed.answers, cnpjDigits(cnpj), {
      hutk: req.cookies.get('hubspotutk')?.value,
      ipAddress: ip,
      pageUri: req.headers.get('referer') ?? undefined,
      pageName: 'Onfly Compass — Teste gratuito',
    });
  } catch (err) {
    console.error('[hubspot] trial falhou', err);
    return NextResponse.json(
      { error: 'Não conseguimos registrar seu cadastro. Tente novamente.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

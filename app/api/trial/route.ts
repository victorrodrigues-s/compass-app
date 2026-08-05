import { NextRequest, NextResponse } from 'next/server';
import { submitTrialInterest } from '@/lib/hubspot';
import { checkRateLimit, clientIp, honeypotTripped } from '@/lib/guard';
import { cnpjDigits, isValidCnpj, isValidEmail } from '@/lib/validation';

/**
 * POST /api/trial
 *
 * CNPJ do "testar grátis" — único dado que ainda não temos nesse ponto do
 * funil, porque é exigência de abertura de conta, não qualificação de lead.
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

  const email = String(raw?.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }

  const cnpj = String(raw?.cnpj ?? '');
  if (!isValidCnpj(cnpj)) {
    return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 });
  }

  try {
    await submitTrialInterest(email, cnpjDigits(cnpj), {
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

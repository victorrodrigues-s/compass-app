import { NextRequest, NextResponse } from 'next/server';
import { submitSpecialistInterest } from '@/lib/hubspot';
import { checkRateLimit, clientIp } from '@/lib/guard';
import { isValidEmail } from '@/lib/validation';

/**
 * POST /api/hubspot
 *
 * Clique em "falar com especialista". Sem UI própria: nenhum dado novo é
 * necessário, então o clique já dispara a atualização do contato no HubSpot
 * (mesmo formulário da etapa 1) com a flag `compass_caminho: especialista`.
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (!checkRateLimit(`specialist:${ip}`, 5, 60_000)) {
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

  const email = String(raw?.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }

  try {
    await submitSpecialistInterest(email, {
      hutk: req.cookies.get('hubspotutk')?.value,
      ipAddress: ip,
      pageUri: req.headers.get('referer') ?? undefined,
      pageName: 'Onfly Compass — Especialista',
    });
  } catch (err) {
    console.error('[hubspot] interesse em especialista falhou', err);
    return NextResponse.json(
      { error: 'Não conseguimos registrar sua solicitação. Tente novamente.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

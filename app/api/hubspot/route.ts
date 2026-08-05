import { NextRequest, NextResponse } from 'next/server';
import { submitSpecialistInterest } from '@/lib/hubspot';
import { checkRateLimit, clientIp } from '@/lib/guard';
import { parseBaseAnswers } from '@/lib/quiz-validation';

/**
 * POST /api/hubspot
 *
 * Clique em "falar com especialista". Reenvia o conjunto base completo de
 * dados (não só o e-mail) — o HubSpot valida campos obrigatórios do
 * formulário em toda submissão, mesmo uma que só pretende reforçar um
 * contato já existente. Ver nota em lib/hubspot.ts.
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

  const parsed = parseBaseAnswers(raw);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await submitSpecialistInterest(parsed.answers, {
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

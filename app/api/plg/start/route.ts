import { NextRequest, NextResponse } from 'next/server';
import { submitPlgForm1 } from '@/lib/plg/hubspot-plg';
import { isCorporateEmail } from '@/lib/plg/validators';
import { checkRateLimit, clientIp, honeypotTripped } from '@/lib/guard';
import { parseBaseAnswers } from '@/lib/quiz-validation';
import { cnpjDigits, isValidCnpj } from '@/lib/validation';

/**
 * POST /api/plg/start
 *
 * Etapa 1 do fluxo PLG (onfly-joyride-flow): dispara o formulário/workflow
 * de aprovação no HubSpot. É um formulário SEPARADO do HUBSPOT_FORM_ID_STEP1
 * do resto do Compass — de propósito, ver lib/plg/hubspot-plg.ts.
 *
 * Reaproveita os dados já coletados no quiz (e-mail, telefone, empresa,
 * gasto mensal) — mas com UMA exceção deliberada: o campo `firstName` do
 * quiz é só um primeiro nome/apelido ("Como podemos te chamar", ver
 * Quiz.tsx), enquanto o form1 do joyride-flow precisa de `nome_completo`
 * de verdade (é o mesmo nome que depois vira firstName/lastName do User
 * Master no formulário 2). Por isso pedimos NOME COMPLETO de novo aqui,
 * junto com o CNPJ — não dá pra derivar isso do que o quiz já coletou sem
 * arriscar mandar um nome errado pro HubSpot/Onfly.
 *
 * O CNPJ é novo aqui também, igual ao /api/trial já existente. Os dois
 * continuam rodando em paralelo (ver TrialForm.tsx): este dispara o fluxo
 * de aprovação/criação de conta; o /api/trial antigo continua reforçando
 * o contato no formulário único do Compass.
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (!checkRateLimit(`plg-start:${ip}`, 5, 60_000)) {
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

  const fullName = String(raw?.fullName ?? '').trim();
  if (fullName.length < 4) {
    return NextResponse.json({ error: 'Informe seu nome completo.' }, { status: 400 });
  }

  // Validado aqui (server) e também no cliente antes de submeter, pra não
  // gastar uma chamada ao HubSpot num e-mail que o workflow vai reprovar
  // de qualquer jeito (motivo "E-mail corporativo..." no projeto.md).
  if (!isCorporateEmail(parsed.answers.email)) {
    return NextResponse.json(
      { error: 'Use um e-mail corporativo (não pessoal) para continuar.' },
      { status: 400 },
    );
  }

  try {
    await submitPlgForm1(
      {
        fullName,
        email: parsed.answers.email,
        phone: parsed.answers.phone,
        cnpj: cnpjDigits(cnpj),
        companyName: parsed.answers.companyName,
        monthlySpend: parsed.answers.monthlySpend,
      },
      {
        hutk: req.cookies.get('hubspotutk')?.value,
        pageUri: req.headers.get('referer') ?? undefined,
        pageName: 'Onfly Compass — PLG start',
      },
    );
  } catch (err) {
    console.error('[plg] /start falhou', err);
    return NextResponse.json(
      { error: 'Não conseguimos iniciar sua avaliação agora. Tente novamente.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

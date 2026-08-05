import { NextRequest, NextResponse } from 'next/server';
import { registerCompany, editCompany } from '@/lib/plg/onfly-api';
import { checkRateLimit, clientIp } from '@/lib/guard';
import { cnpjDigits, isValidCnpj, isValidEmail } from '@/lib/validation';

/**
 * POST /api/plg/provision
 *
 * Etapa 4 do fluxo PLG — roda automaticamente assim que o polling detecta
 * aprovação, ANTES de mostrar o formulário 2 pro usuário (ver projeto.md:
 * "Pré-Formulário 2 (invisível para o usuário)"). Cria a empresa na Onfly
 * e já habilita ela em seguida.
 *
 * Chamada só uma vez por sessão de aprovação — o cliente (PlgFlow.tsx)
 * garante isso via estado de step, não esta rota.
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (!checkRateLimit(`plg-provision:${ip}`, 5, 60_000)) {
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

  const cnpj = cnpjDigits(String(raw?.cnpj ?? ''));
  const email = String(raw?.email ?? '').trim();
  const companyName = String(raw?.companyName ?? '').trim();
  const fullName = String(raw?.fullName ?? '').trim();
  const phone = String(raw?.phone ?? '').trim();

  if (!isValidCnpj(cnpj)) return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  if (companyName.length < 2 || fullName.length < 4) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
  }

  try {
    const registered = await registerCompany({ companyName, cnpj, phone, email, contactName: fullName });
    await editCompany({
      onflyCompanyId: registered.onflyCompanyId,
      cnpj,
      financialEmail: email,
    });

    return NextResponse.json({
      onflyCompanyId: registered.onflyCompanyId,
      userId: registered.userId,
      hash: registered.hash,
    });
  } catch (err) {
    console.error('[plg] /provision falhou', err);
    return NextResponse.json(
      { error: 'Não conseguimos preparar sua conta agora. Tente novamente em instantes.' },
      { status: 502 },
    );
  }
}

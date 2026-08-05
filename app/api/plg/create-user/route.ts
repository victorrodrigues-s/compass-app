import { NextRequest, NextResponse } from 'next/server';
import { createEmployee, createEmployeePreferences } from '@/lib/plg/onfly-api';
import { checkRateLimit, clientIp } from '@/lib/guard';
import { isValidEmail } from '@/lib/validation';
import { cpfDigits, formatCpf, isValidCpf, isValidPassword } from '@/lib/plg/validators';

/**
 * POST /api/plg/create-user
 *
 * Etapa 6 do fluxo PLG — submit do formulário 2 (dados do User Master).
 * Dispara employee-create e employee-create/…/preferences EM PARALELO
 * (Promise.all), exatamente como o projeto.md pede.
 *
 * hash e userId vêm da etapa de provisionamento (/api/plg/provision) — o
 * cliente guarda no estado do PlgFlow e manda de volta aqui.
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (!checkRateLimit(`plg-create-user:${ip}`, 5, 60_000)) {
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

  const hash = String(raw?.hash ?? '');
  const userId = Number(raw?.userId);
  const firstName = String(raw?.firstName ?? '').trim();
  const lastName = String(raw?.lastName ?? '').trim();
  const fullName = String(raw?.fullName ?? '').trim();
  const email = String(raw?.email ?? '').trim();
  const companyName = String(raw?.companyName ?? '').trim();
  const birthday = String(raw?.birthday ?? '').trim();
  const gender: 'male' | 'female' | null =
    raw?.gender === 'female' ? 'female' : raw?.gender === 'male' ? 'male' : null;
  const password = String(raw?.password ?? '');
  const passwordConfirm = String(raw?.passwordConfirm ?? '');
  const cpfRaw = String(raw?.cpf ?? '');

  if (!hash || !userId) {
    return NextResponse.json({ error: 'Sessão inválida — recarregue e tente de novo.' }, { status: 400 });
  }
  if (firstName.length < 1 || lastName.length < 1) {
    return NextResponse.json({ error: 'Informe nome e sobrenome.' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    return NextResponse.json({ error: 'Data de nascimento inválida.' }, { status: 400 });
  }
  if (!gender) {
    return NextResponse.json({ error: 'Selecione o gênero.' }, { status: 400 });
  }
  if (!isValidCpf(cpfRaw)) {
    return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ error: 'As senhas não coincidem.' }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json(
      { error: 'A senha não atende aos requisitos mínimos.' },
      { status: 400 },
    );
  }

  const employeeInput = {
    hash,
    userId,
    firstName,
    lastName,
    fullName,
    email,
    companyName,
    birthday,
    gender,
    password,
    passwordConfirm,
    cpfFormatted: formatCpf(cpfRaw),
    cpfDigitsOnly: cpfDigits(cpfRaw),
  };

  try {
    // Em paralelo, como pede o projeto.md — um endpoint falhar não deve
    // impedir a tentativa do outro, mas qualquer falha aqui precisa
    // aparecer pro usuário (diferente do padrão "loga e segue" do
    // /api/compass — aqui, sem isso, a conta fica pela metade).
    const [employeeResult, preferencesResult] = await Promise.allSettled([
      createEmployee(employeeInput),
      createEmployeePreferences(employeeInput),
    ]);

    const failures = [employeeResult, preferencesResult].filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.error('[plg] /create-user — uma ou mais chamadas falharam', failures);
      return NextResponse.json(
        {
          error:
            'Sua conta foi criada, mas houve um problema ao configurar as preferências. Nosso time vai verificar — você já pode tentar fazer login.',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[plg] /create-user falhou', err);
    return NextResponse.json(
      { error: 'Não conseguimos criar sua conta agora. Tente novamente em instantes.' },
      { status: 502 },
    );
  }
}

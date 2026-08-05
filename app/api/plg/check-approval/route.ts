import { NextRequest, NextResponse } from 'next/server';
import { checkPlgApproval } from '@/lib/plg/hubspot-plg';
import { checkRateLimit, clientIp } from '@/lib/guard';
import { cnpjDigits, isValidCnpj } from '@/lib/validation';

/**
 * GET /api/plg/check-approval?cnpj=...
 *
 * Etapa 2 do fluxo PLG — o cliente faz polling nesta rota (a cada 5s, até
 * 3min, ver hooks/usePlgApprovalPolling.ts) enquanto o workflow de
 * aprovação roda do lado do HubSpot. Limite de rate um pouco mais alto que
 * as outras rotas de propósito — é chamada repetidamente pela mesma
 * pessoa durante a espera, não é um formulário de submissão única.
 */

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  if (!checkRateLimit(`plg-check:${ip}`, 45, 60_000)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde um minuto e tente de novo.' },
      { status: 429 },
    );
  }

  const cnpjRaw = req.nextUrl.searchParams.get('cnpj') ?? '';
  const cnpj = cnpjDigits(cnpjRaw);
  if (!isValidCnpj(cnpj)) {
    return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 });
  }

  try {
    const result = await checkPlgApproval(cnpj);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[plg] /check-approval falhou', err);
    return NextResponse.json(
      { error: 'Não conseguimos consultar o status agora. Tente novamente em instantes.' },
      { status: 502 },
    );
  }
}

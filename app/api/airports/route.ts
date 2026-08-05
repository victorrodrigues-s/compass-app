import { NextRequest, NextResponse } from 'next/server';
import { getFareProvider } from '@/lib/fares';
import { checkRateLimit, clientIp } from '@/lib/guard';

/**
 * GET /api/airports?q=...
 *
 * Alimenta o autocomplete de origem e destino. O browser nunca fala com a
 * Ignav direto — a chave de API fica só no servidor.
 *
 * CUSTO: cada chamada aqui pode virar uma requisição paga na Ignav. Três
 * defesas: mínimo de 3 caracteres, rate limit agressivo por IP, e o cache do
 * provider. O componente ainda aplica debounce antes de chamar.
 */

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  // Limite alto o bastante para digitação normal, baixo para script.
  if (!checkRateLimit(`airports:${ip}`, 30, 60_000)) {
    return NextResponse.json({ airports: [] }, { status: 429 });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  // Abaixo de 3 caracteres nem chamamos o fornecedor.
  if (q.length < 3) return NextResponse.json({ airports: [] });

  try {
    const airports = await getFareProvider().searchAirports(q);
    return NextResponse.json({ airports });
  } catch (err) {
    console.error('[airports] busca falhou', err);
    return NextResponse.json(
      { airports: [], error: 'Não foi possível buscar aeroportos agora.' },
      { status: 503 },
    );
  }
}

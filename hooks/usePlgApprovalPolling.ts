'use client';

import { useEffect, useState } from 'react';
import type { PlgApprovalCheck } from '@/lib/plg/hubspot-plg';

/**
 * Polling do status de aprovação — intervalo de 5s, timeout de 3min (36
 * tentativas), exatamente como especificado no projeto.md do
 * onfly-joyride-flow.
 */
const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 36;

export type PollingOutcome =
  | { kind: 'waiting'; attempt: number }
  | { kind: 'approved' }
  | { kind: 'denied'; reasonRaw: string; message: string }
  | { kind: 'timeout' }
  | { kind: 'error'; message: string };

/**
 * `resetKey` existe só pra permitir "tentar de novo" depois de um timeout
 * ou erro — mudar esse valor reinicia o polling do zero mesmo com o mesmo
 * CNPJ (o efeito abaixo depende dos dois).
 *
 * BUG CORRIGIDO (05/08): a versão anterior guardava `attempt` e a flag de
 * "parar" em useRef, compartilhados entre execuções do efeito. Em dev, com
 * reactStrictMode ligado (next.config.mjs), o React monta o efeito, limpa,
 * e monta de novo — e como os refs são os MESMOS objetos nas duas
 * execuções, a segunda montagem zerava o contador e reabria a flag de
 * "parar" enquanto o poll() da primeira montagem ainda estava com um
 * fetch em voo. Resultado: duas cadeias de polling rodando em paralelo
 * sobre o mesmo contador compartilhado, chegando ao limite de tentativas
 * bem mais rápido que os 3 minutos esperados — e de um jeito que parecia
 * "travado" porque o texto virava o de timeout sem o usuário perceber os
 * ciclos de fetch acontecendo. Corrigido usando `cancelled`/`attempt`
 * como variáveis locais do próprio efeito (closure), não refs — cada
 * montagem do efeito agora tem sua própria contagem isolada, e o guard
 * de cancelamento é checado de novo DEPOIS do await, não só antes.
 */
export function usePlgApprovalPolling(cnpj: string | null, resetKey: number = 0): PollingOutcome {
  const [outcome, setOutcome] = useState<PollingOutcome>({ kind: 'waiting', attempt: 0 });

  useEffect(() => {
    if (!cnpj) return;

    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;
    setOutcome({ kind: 'waiting', attempt: 0 });

    async function poll() {
      if (cancelled) return;
      attempt += 1;

      try {
        const res = await fetch(`/api/plg/check-approval?cnpj=${encodeURIComponent(cnpj as string)}`);
        if (cancelled) return; // reconfirma DEPOIS do await — é aqui que o bug antigo escapava

        const data: PlgApprovalCheck | { error: string } = await res.json();
        if (cancelled) return;

        if (!res.ok || 'error' in data) {
          setOutcome({
            kind: 'error',
            message: 'error' in data ? data.error : 'Falha ao consultar o status.',
          });
          return;
        }

        if (data.state === 'approved') {
          setOutcome({ kind: 'approved' });
          return;
        }
        if (data.state === 'denied') {
          setOutcome({ kind: 'denied', reasonRaw: data.reasonRaw, message: data.message });
          return;
        }
        // 'pending' e 'unknown' seguem tentando — 'unknown' significa que o
        // HubSpot retornou um valor não mapeado em DENIAL_MESSAGES; melhor
        // continuar esperando do que travar a pessoa numa mensagem errada.
      } catch {
        // Falha de rede pontual não interrompe o polling — só timeout.
      }

      if (cancelled) return;

      if (attempt >= MAX_ATTEMPTS) {
        setOutcome({ kind: 'timeout' });
        return;
      }

      setOutcome((prev) => (prev.kind === 'waiting' ? { kind: 'waiting', attempt } : prev));
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cnpj, resetKey]);

  return outcome;
}

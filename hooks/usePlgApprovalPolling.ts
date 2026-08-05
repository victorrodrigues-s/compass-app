'use client';

import { useEffect, useRef, useState } from 'react';
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
 */
export function usePlgApprovalPolling(cnpj: string | null, resetKey: number = 0): PollingOutcome {
  const [outcome, setOutcome] = useState<PollingOutcome>({ kind: 'waiting', attempt: 0 });
  const attemptRef = useRef(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!cnpj) return;
    stoppedRef.current = false;
    attemptRef.current = 0;
    setOutcome({ kind: 'waiting', attempt: 0 });

    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (stoppedRef.current) return;
      attemptRef.current += 1;

      try {
        const res = await fetch(`/api/plg/check-approval?cnpj=${encodeURIComponent(cnpj as string)}`);
        const data: PlgApprovalCheck | { error: string } = await res.json();

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

      if (attemptRef.current >= MAX_ATTEMPTS) {
        setOutcome({ kind: 'timeout' });
        return;
      }

      setOutcome((prev) => (prev.kind === 'waiting' ? { kind: 'waiting', attempt: attemptRef.current } : prev));
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      stoppedRef.current = true;
      clearTimeout(timer);
    };
  }, [cnpj, resetKey]);

  return outcome;
}

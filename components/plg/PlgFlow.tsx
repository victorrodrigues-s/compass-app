'use client';

import { useEffect, useState } from 'react';
import { usePlgApprovalPolling } from '@/hooks/usePlgApprovalPolling';
import AnalyzingStep from './AnalyzingStep';
import DeniedStep from './DeniedStep';
import Form2Step from './Form2Step';
import SuccessStep from './SuccessStep';

export interface PlgFlowProps {
  cnpj: string; // só dígitos
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  /** Reprovação → "Tentar novamente" volta pro formulário de CNPJ/nome, fora deste componente. */
  onRestart: () => void;
  /** Escape hatch: se o provisionamento falhar repetidamente, oferece o cadastro manual antigo em vez de travar a pessoa aqui. */
  manualSignupUrl?: string;
}

interface ProvisionData {
  onflyCompanyId: number;
  userId: number;
  hash: string;
}

type Phase = 'polling' | 'provisioning' | 'provision-error' | 'form2' | 'success';

/**
 * Orquestrador das etapas 2 a 6 do projeto.md (onfly-joyride-flow) — a
 * etapa 1 (form1) já rodou em /api/plg/start antes deste componente
 * existir (ver TrialForm.tsx). A partir daqui é: polling → provisionamento
 * automático → formulário 2 → sucesso, ou reprovação a qualquer momento
 * do polling.
 */
export default function PlgFlow({
  cnpj,
  fullName,
  email,
  phone,
  companyName,
  onRestart,
  manualSignupUrl,
}: PlgFlowProps) {
  const [phase, setPhase] = useState<Phase>('polling');
  const [pollResetKey, setPollResetKey] = useState(0);
  const [provisionData, setProvisionData] = useState<ProvisionData | null>(null);
  const polling = usePlgApprovalPolling(cnpj, pollResetKey);

  useEffect(() => {
    if (polling.kind !== 'approved' || phase !== 'polling') return;

    let cancelled = false;
    setPhase('provisioning');

    (async () => {
      try {
        const res = await fetch('/api/plg/provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cnpj, email, companyName, fullName, phone }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          setPhase('provision-error');
          return;
        }
        setProvisionData(data);
        setPhase('form2');
      } catch {
        if (!cancelled) setPhase('provision-error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [polling.kind, phase, cnpj, email, companyName, fullName, phone]);

  if (polling.kind === 'denied' && phase === 'polling') {
    return <DeniedStep message={polling.message} onRetry={onRestart} />;
  }

  if (phase === 'provisioning') {
    return (
      <AnalyzingStep
        title="Preparando seu acesso"
        description="Estamos configurando sua empresa na Onfly. Não feche esta aba."
      />
    );
  }

  if (phase === 'provision-error') {
    return (
      <div className="oc-card oc-question" style={{ textAlign: 'center' }}>
        <p className="oc-eyebrow">Ops</p>
        <h2 className="oc-question-title">Não conseguimos preparar sua conta agora</h2>
        <p className="oc-question-help">Isso pode ser um problema pontual. Tente de novo em instantes.</p>
        <button
          type="button"
          className="oc-btn oc-btn-primary"
          style={{ marginTop: 12 }}
          onClick={() => setPhase('polling')}
        >
          Tentar de novo
        </button>
        {manualSignupUrl ? (
          <p style={{ marginTop: 14 }}>
            <a href={manualSignupUrl} target="_blank" rel="noopener noreferrer">
              Ou continue o cadastro manualmente
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  if (phase === 'form2' && provisionData) {
    return (
      <Form2Step
        hash={provisionData.hash}
        userId={provisionData.userId}
        fullName={fullName}
        email={email}
        companyName={companyName}
        onSuccess={() => setPhase('success')}
      />
    );
  }

  if (phase === 'success') {
    return <SuccessStep email={email} />;
  }

  // phase === 'polling', ainda sem resultado (waiting/timeout/error)
  return (
    <AnalyzingStep
      timedOut={polling.kind === 'timeout'}
      errored={polling.kind === 'error'}
      onRetry={() => setPollResetKey((k) => k + 1)}
    />
  );
}

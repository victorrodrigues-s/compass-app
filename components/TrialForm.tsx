'use client';

import { useState } from 'react';
import { HONEYPOT_FIELD } from '@/lib/guard';
import { cnpjDigits, formatCnpj, isValidCnpj } from '@/lib/validation';

/**
 * "Testar gratuitamente" — único campo pendente é o CNPJ.
 *
 * Todo o resto (empresa via e-mail corporativo, gasto, como conheceu) já foi
 * coletado no quiz. CNPJ fica de fora do quiz porque é exigência de abertura
 * de conta, não pergunta de qualificação — só faz sentido pedir pra quem
 * realmente vai criar a conta agora.
 */

export interface TrialFormProps {
  email: string;
  onSubmitted: () => void;
}

export default function TrialForm({ email, onSubmitted }: TrialFormProps) {
  const [cnpj, setCnpj] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cnpjComplete = cnpjDigits(cnpj).length === 14;
  const cnpjOk = isValidCnpj(cnpj);

  async function handleSubmit() {
    if (!cnpjOk || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cnpj: cnpjDigits(cnpj), [HONEYPOT_FIELD]: honeypot }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Não conseguimos registrar seu cadastro. Tente novamente.');
        return;
      }
      onSubmitted();
    } catch {
      setError('Falha de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="oc-card oc-question">
      <p className="oc-eyebrow">Teste gratuito</p>
      <h2 className="oc-question-title" style={{ marginTop: 8 }}>
        Só falta o CNPJ para você acessar a Onfly grátis!
      </h2>
      <p className="oc-question-help">
        Como somos uma plataforma para viagens corporativas, a conta já sai configurada para sua
        empresa.
      </p>

      {error ? <p className="oc-error">{error}</p> : null}

      <div className="oc-field">
        <label className="oc-label" htmlFor="oc-cnpj">
          CNPJ
        </label>
        <input
          id="oc-cnpj"
          className="oc-input"
          value={cnpj}
          onChange={(e) => setCnpj(formatCnpj(e.target.value))}
          inputMode="numeric"
          placeholder="00.000.000/0000-00"
        />
        {cnpjComplete && !cnpjOk ? (
          <span style={{ fontSize: 13, color: 'var(--oc-red)' }}>
            Esse CNPJ não confere. Verifique os números.
          </span>
        ) : null}
      </div>

      <div className="oc-honeypot" aria-hidden="true">
        <label htmlFor="oc-hp-trial">Website</label>
        <input
          id="oc-hp-trial"
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <p className="oc-muted" style={{ marginBottom: 18 }}>
        A conta será criada para {email}.
      </p>

      <button
        type="button"
        className="oc-btn oc-btn-primary oc-btn-block"
        disabled={!cnpjOk || submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Enviando…' : 'Criar minha conta grátis'}
      </button>
    </div>
  );
}

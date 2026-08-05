'use client';

import { useState } from 'react';
import { HONEYPOT_FIELD } from '@/lib/guard';
import { cnpjDigits, formatCnpj, isValidCnpj } from '@/lib/validation';
import { isCorporateEmail } from '@/lib/plg/validators';
import type { QuizAnswers } from '@/lib/types';

/**
 * "Testar gratuitamente" — CNPJ + nome completo.
 *
 * O resto (empresa, gasto, como conheceu, e-mail, telefone) já foi
 * coletado no quiz. Nome completo é NOVO aqui: o campo do quiz
 * (`answers.firstName`) é só um apelido ("Como podemos te chamar", ver
 * Quiz.tsx) — não dá pra usar como nome legal no formulário de aprovação
 * PLG nem depois, quando vira firstName/lastName do usuário criado na
 * Onfly (ver PlgFlow.tsx / Form2Step.tsx).
 *
 * No submit, duas coisas rodam:
 *   1. /api/trial (já existia) — reforça o contato no formulário único do
 *      Compass. Fire-and-forget: falha aqui não deveria travar quem já
 *      preencheu tudo, mesmo padrão do resto do app.
 *   2. /api/plg/start (novo) — dispara o workflow de aprovação do
 *      onfly-joyride-flow, num formulário/portal SEPARADO do HubSpot. Essa
 *      SIM precisa ter sucesso pra avançar — sem ela não tem o que fazer
 *      polling depois.
 */

export interface TrialFormProps {
  answers: QuizAnswers;
  onPlgStarted: (cnpjDigitsOnly: string, fullName: string) => void;
}

export default function TrialForm({ answers, onPlgStarted }: TrialFormProps) {
  const [cnpj, setCnpj] = useState('');
  const [fullName, setFullName] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cnpjComplete = cnpjDigits(cnpj).length === 14;
  const cnpjOk = isValidCnpj(cnpj);
  const fullNameOk = fullName.trim().length >= 4;
  const emailOk = isCorporateEmail(answers.email);

  const canSubmit = cnpjOk && fullNameOk && emailOk && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const cnpjClean = cnpjDigits(cnpj);
    const trimmedName = fullName.trim();

    // Fire-and-forget — não bloqueia nem impede o avanço se falhar.
    fetch('/api/trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...answers, cnpj: cnpjClean, [HONEYPOT_FIELD]: honeypot }),
    }).catch((err) => console.error('[trial] reforço do contato no Compass falhou', err));

    try {
      const res = await fetch('/api/plg/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...answers,
          cnpj: cnpjClean,
          fullName: trimmedName,
          [HONEYPOT_FIELD]: honeypot,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Não conseguimos iniciar sua avaliação. Tente novamente.');
        return;
      }
      onPlgStarted(cnpjClean, trimmedName);
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
        Só faltam dois dados para você acessar a Onfly grátis!
      </h2>
      <p className="oc-question-help">
        Como somos uma plataforma para viagens corporativas, a conta já sai configurada para sua
        empresa.
      </p>

      {error ? <p className="oc-error">{error}</p> : null}
      {!emailOk ? (
        <p className="oc-error">
          O e-mail {answers.email} parece pessoal, não corporativo — o acesso gratuito exige e-mail
          da empresa. Volte ao diagnóstico e ajuste o e-mail informado.
        </p>
      ) : null}

      <div className="oc-field">
        <label className="oc-label" htmlFor="oc-fullname">
          Nome completo
        </label>
        <input
          id="oc-fullname"
          className="oc-input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          placeholder="Nome e sobrenome"
        />
      </div>

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
        A conta será criada para {answers.email}.
      </p>

      <button
        type="button"
        className="oc-btn oc-btn-primary oc-btn-block"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {submitting ? 'Enviando…' : 'Criar minha conta grátis'}
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Quiz from './Quiz';
import Report from './Report';
import TrialForm from './TrialForm';
import { HONEYPOT_FIELD } from '@/lib/guard';
import { TRIAL_ONLY_SPEND, type CompassReport, type QuizAnswers } from '@/lib/types';

/**
 * Máquina de estados do funil:
 *
 *   quiz ──> report ──> (thank-you direto | trial) ──> done
 *
 * "Calculando" NÃO é um stage próprio — é um booleano (`submitting`) passado
 * pro Quiz, que continua montado o tempo todo da submissão. Antes disso era
 * um stage separado que trocava a tela inteira; isso REMONTAVA o Quiz ao
 * voltar de um erro, e remontar zera todo o state interno dele (em que
 * pergunta a pessoa estava, o que já tinha digitado). Resultado: uma falha
 * pontual de rede fazia o quiz inteiro "reiniciar" para quem já tinha
 * respondido tudo. Manter o componente montado evita esse problema por
 * completo — a pessoa só vê o botão trocar para "Calculando…" e, se falhar,
 * continua exatamente onde estava.
 *
 * "Falar com especialista" não tem tela própria: ao clicar, já mostramos o
 * agradecimento e disparamos a atualização do HubSpot em segundo plano — sem
 * bloquear a experiência, mesmo padrão já usado no restante do fluxo (uma
 * falha nossa não deveria virar problema de quem já preencheu tudo).
 */

type Stage = 'quiz' | 'report' | 'trial' | 'done' | 'trial-done';

export interface CompassFlowProps {
  trialUrl: string;
}

export default function CompassFlow({ trialUrl }: CompassFlowProps) {
  const [stage, setStage] = useState<Stage>('quiz');
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<CompassReport | null>(null);
  const [answers, setAnswers] = useState<QuizAnswers | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleQuizComplete(quizAnswers: QuizAnswers, honeypot: string) {
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/compass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...quizAnswers, [HONEYPOT_FIELD]: honeypot }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Fica no stage 'quiz' — o Quiz NUNCA desmonta aqui, então tudo que
        // a pessoa já respondeu continua exatamente como estava.
        setError(data.error ?? 'Não conseguimos gerar seu diagnóstico. Tente novamente.');
        setSubmitting(false);
        return;
      }

      setAnswers(quizAnswers);
      setReport(data.report);
      setStage('report');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Falha de conexão. Verifique sua internet e tente novamente.');
      setSubmitting(false);
    }
  }

  function handleRequestSpecialist() {
    if (!answers) return;
    setStage('done');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Fire-and-forget: o usuário já respondeu o quiz inteiro, uma falha aqui
    // não deveria virar tela de erro para ele. Manda o conjunto base
    // completo, não só o e-mail — o HubSpot valida campos obrigatórios do
    // formulário em toda submissão, mesmo essa que só reforça o contato.
    fetch('/api/hubspot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    }).catch((err) => console.error('[compass] interesse em especialista falhou', err));
  }

  if (stage === 'report' && report && answers) {
    return (
      <Report
        report={report}
        showSpecialistOption={answers.monthlySpend !== TRIAL_ONLY_SPEND}
        onRequestSpecialist={handleRequestSpecialist}
        onTrial={() => {
          setStage('trial');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (stage === 'trial' && answers) {
    return (
      <>
        <TrialForm
          answers={answers}
          onSubmitted={() => {
            setStage('trial-done');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button type="button" className="oc-btn oc-btn-ghost" onClick={() => setStage('report')}>
            Voltar ao diagnóstico
          </button>
        </div>
      </>
    );
  }

  if (stage === 'trial-done') {
    return (
      <div className="oc-card oc-success">
        <div className="oc-success-mark" aria-hidden="true">
          ✓
        </div>
        <h2 className="oc-h2">Tudo certo para começar</h2>
        <p className="oc-lead" style={{ maxWidth: '46ch', margin: '8px auto 0' }}>
          Continue no cadastro para definir sua senha e fazer a primeira busca.
        </p>
        <div style={{ marginTop: 24 }}>
          <a
            className="oc-btn oc-btn-primary"
            href={trialUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', textDecoration: 'none' }}
          >
            Continuar o cadastro
          </a>
        </div>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="oc-card oc-success">
        <div className="oc-success-mark" aria-hidden="true">
          ✓
        </div>
        <h2 className="oc-h2">Recebemos sua solicitação</h2>
        <p className="oc-lead" style={{ marginTop: 8, maxWidth: '46ch', margin: '8px auto 0' }}>
          Um especialista entra em contato em até um dia útil.
        </p>
      </div>
    );
  }

  return <Quiz onComplete={handleQuizComplete} submitting={submitting} error={error} />;
}

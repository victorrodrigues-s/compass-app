'use client';

interface DeniedStepProps {
  message: string;
  onRetry: () => void;
}

const SPECIALIST_EMAIL = 'davi.dutra@onfly.com.br';

/**
 * Etapa 3 (reprovação) — duas ações obrigatórias por especificação do
 * projeto.md: refazer o formulário, ou falar com especialista por e-mail.
 */
export default function DeniedStep({ message, onRetry }: DeniedStepProps) {
  return (
    <div className="oc-card oc-question" style={{ textAlign: 'center' }}>
      <p className="oc-eyebrow">Não foi dessa vez</p>
      <h2 className="oc-question-title">Não conseguimos aprovar seu acesso agora</h2>
      <p className="oc-question-help">{message}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
        <button type="button" className="oc-btn oc-btn-primary oc-btn-block" onClick={onRetry}>
          Tentar novamente
        </button>
        <a
          className="oc-btn oc-btn-ghost oc-btn-block"
          href={`mailto:${SPECIALIST_EMAIL}`}
          style={{ textDecoration: 'none', textAlign: 'center' }}
        >
          Falar com especialista
        </a>
      </div>
    </div>
  );
}

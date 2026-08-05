'use client';

interface AnalyzingStepProps {
  timedOut?: boolean;
  errored?: boolean;
  onRetry?: () => void;
  /** Override de texto — usado também pela etapa de provisionamento (4A/4B), que reaproveita este mesmo componente. */
  title?: string;
  description?: string;
}

/**
 * Etapa 2 do projeto.md — standby enquanto o workflow de aprovação roda no
 * HubSpot. "Não feche esta aba" é literal: se a pessoa fechar, o polling
 * para e ela não vê o resultado (não existe notificação assíncrona neste
 * fluxo ainda).
 *
 * Também reaproveitado (com title/description customizados) pra etapa 4
 * (criar/habilitar empresa), que é automática e não tem estado de
 * timeout/erro exposto pro usuário do mesmo jeito.
 */
export default function AnalyzingStep({ timedOut, errored, onRetry, title, description }: AnalyzingStepProps) {
  return (
    <div className="oc-card oc-question" style={{ textAlign: 'center' }}>
      <p className="oc-eyebrow">Analisando</p>
      <div className="oc-plg-spinner" aria-hidden="true" />
      <h2 className="oc-question-title" style={{ marginTop: 16 }}>
        {title ??
          (errored
            ? 'Não conseguimos consultar o status agora'
            : timedOut
              ? 'Ainda estamos analisando — pode demorar um pouco mais'
              : 'Estamos validando seu CNPJ')}
      </h2>
      <p className="oc-question-help">
        {description ??
          (errored
            ? 'Tente consultar de novo em alguns instantes.'
            : timedOut
              ? 'Isso normalmente é rápido, mas às vezes leva mais tempo. Não feche esta aba.'
              : 'Não feche esta aba — isso costuma levar só alguns instantes.')}
      </p>
      {(timedOut || errored) && onRetry ? (
        <button type="button" className="oc-btn oc-btn-primary" onClick={onRetry} style={{ marginTop: 12 }}>
          Verificar novamente
        </button>
      ) : null}
      <style jsx>{`
        .oc-plg-spinner {
          width: 40px;
          height: 40px;
          margin: 8px auto 0;
          border-radius: 50%;
          border: 3px solid var(--oc-line);
          border-top-color: var(--oc-blue);
          animation: oc-plg-spin 0.8s linear infinite;
        }
        @keyframes oc-plg-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

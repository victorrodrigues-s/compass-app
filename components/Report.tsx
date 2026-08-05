'use client';

import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/compass';
import type { CompassReport } from '@/lib/types';

/**
 * O report — parametrizado pelo JSON `report`.
 *
 * CTAs: "falar com especialista" só aparece para quem NÃO respondeu a menor
 * faixa de gasto mensal — regra vem de `showSpecialistOption`, calculada em
 * CompassFlow a partir da resposta do quiz.
 */

function useCountUp(target: number, durationMs = 1100): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, durationMs]);

  return value;
}

export interface ReportProps {
  report: CompassReport;
  showSpecialistOption: boolean;
  onRequestSpecialist: () => void;
  onTrial: () => void;
}

export default function Report({
  report,
  showSpecialistOption,
  onRequestSpecialist,
  onTrial,
}: ReportProps) {
  const animatedSavings = useCountUp(report.projection.annualSavingsCents);

  return (
    <div className="oc-report">
      <div className="oc-card">
        <header className="oc-report-header">
          <p className="oc-eyebrow">Diagnóstico Onfly Compass</p>
          <h1 className="oc-h1">
            {report.user.firstName}, veja o que a sua empresa deixa na mesa hoje
          </h1>
          <p className="oc-lead">
            Buscamos a tarifa real de <strong>{report.quote.routeLabel}</strong> e comparamos com o
            que vocês pagariam na Onfly.
          </p>
        </header>

        <div className="oc-compare">
          <div className="oc-compare-head">
            <div>Item</div>
            <div>Como você faz hoje</div>
            <div className="oc-compare-head-onfly">Com a Onfly</div>
          </div>
          {report.quote.rows.map((row, i) => (
            <div
              key={row.label}
              className="oc-compare-row"
              data-highlight={row.highlight === true}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="oc-compare-label">{row.label}</div>
              <div className="oc-compare-today">{row.today}</div>
              <div className="oc-compare-onfly">{row.onfly}</div>
            </div>
          ))}
        </div>

        <p className="oc-muted">
          Economia de{' '}
          <strong>{formatMoney(report.quote.savingsPerTripCents, report.quote.currency)}</strong>{' '}
          em uma única passagem, antes dos ganhos de tempo e de política.
        </p>

        <div className="oc-savings">
          <p className="oc-savings-label">Projeção de economia anual</p>
          <p className="oc-savings-value">{formatMoney(animatedSavings, report.quote.currency)}</p>
          <p className="oc-savings-note">
            Estimativa para {report.projection.tripsPerYear} viagens por ano, somando a diferença de
            tarifa e o tempo operacional devolvido ao time.
          </p>
        </div>

        <div className="oc-metrics">
          <div className="oc-metric">
            <p className="oc-metric-value">
              {formatMoney(report.quote.savingsPerTripCents, report.quote.currency)}
            </p>
            <p className="oc-metric-label">por passagem neste trecho</p>
          </div>
          <div className="oc-metric">
            <p className="oc-metric-value">{report.projection.hoursSavedPerYear}h</p>
            <p className="oc-metric-label">de trabalho operacional por ano</p>
          </div>
          <div className="oc-metric">
            <p className="oc-metric-value">{report.projection.tripsPerYear}</p>
            <p className="oc-metric-label">viagens consideradas no cálculo</p>
          </div>
        </div>

        <h2 className="oc-h2" style={{ marginTop: 34 }}>
          Como a Onfly chega nesses números
        </h2>
        <div className="oc-pillars">
          {report.pillars.map((pillar) => (
            <div key={pillar.n} className="oc-pillar">
              <p className="oc-pillar-n">{pillar.n}</p>
              <h3 className="oc-h3">{pillar.title}</h3>
              <p className="oc-pillar-body">{pillar.body}</p>
              <span className="oc-chip">{pillar.chip}</span>
            </div>
          ))}
        </div>

        <h2 className="oc-h2" style={{ marginTop: 34, marginBottom: 14 }}>
          {showSpecialistOption ? 'Como você quer seguir?' : 'Você ganhou acesso à Onfly grátis!'}
        </h2>

        <div className="oc-pillars">
          {showSpecialistOption ? (
            <div className="oc-pillar">
              <span className="oc-chip oc-chip-green" style={{ marginBottom: 10 }}>
                Recomendado
              </span>
              <h3 className="oc-h3">Falar com um especialista</h3>
              <p className="oc-pillar-body">
                15 minutos para ver essa economia funcionando com os trechos reais da sua empresa.
              </p>
              <button type="button" className="oc-btn oc-btn-primary" onClick={onRequestSpecialist}>
                Quero falar com um especialista
              </button>
            </div>
          ) : null}

          <div className="oc-pillar" style={{ borderLeftColor: 'var(--oc-line)' }}>
            <h3 className="oc-h3">Testar gratuitamente</h3>
            <p className="oc-pillar-body">
              Crie uma conta gratuita e faça sua primeira busca agora mesmo.
            </p>
            <button
              type="button"
              className={showSpecialistOption ? 'oc-btn oc-btn-ghost' : 'oc-btn oc-btn-primary'}
              onClick={onTrial}
            >
              Criar conta grátis
            </button>
          </div>
        </div>

        <footer className="oc-provenance">
          <p>
            Tarifa de mercado consultada em fontes públicas de passagens para{' '}
            {new Date(report.quote.departureDate + 'T12:00:00').toLocaleDateString('pt-BR')}
            {report.quote.carrier ? ` (${report.quote.carrier})` : ''}, classe econômica, ida.
            O valor Onfly aplica {report.quote.discountPercent.toString().replace('.', ',')}% de
            desconto sobre essa tarifa. Preços de passagem variam por data, antecedência e
            disponibilidade.
          </p>
          <p style={{ marginTop: 8 }}>
            A projeção anual é uma estimativa que soma a diferença de tarifa ao tempo operacional
            devolvido ao time, e depende do volume informado por você.
          </p>
          {report.meta.unverifiedPrice ? (
            <p style={{ marginTop: 8 }}>
              A tarifa deste trecho não pôde ser confirmada junto ao fornecedor no momento da
              consulta — trate como referência.
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import AirportSelect from './AirportSelect';
import { HONEYPOT_FIELD } from '@/lib/guard';
import { formatPhone, isValidEmail, isValidPhone } from '@/lib/validation';
import {
  HOW_HEARD_OPTIONS,
  MONTHLY_SPEND_OPTIONS,
  type Airport,
  type BookingMethod,
  type MainPain,
  type MonthlySpendBand,
  type QuizAnswers,
  type TripVolumeBand,
} from '@/lib/types';

/**
 * O quiz — 6 telas.
 *
 * O trecho (origem/destino) vem ANTES da identificação: assim, quando a
 * pessoa chega na tela final ("Sua cotação com diagnóstico está pronta!"),
 * já demos o trabalho pesado (buscar aeroportos) e só falta o contato + como
 * conheceu para liberar o resultado — os dois ficam juntos na mesma tela,
 * que também é onde o diagnóstico é de fato disparado.
 */

const TOTAL_STEPS = 6;

const VOLUME_OPTIONS: { value: TripVolumeBand; label: string; hint: string }[] = [
  { value: '1-10', label: 'Até 10 viagens', hint: 'por mês' },
  { value: '11-30', label: '11 a 30 viagens', hint: 'por mês' },
  { value: '31-80', label: '31 a 80 viagens', hint: 'por mês' },
  { value: '80+', label: 'Mais de 80 viagens', hint: 'por mês' },
];

const METHOD_OPTIONS: { value: BookingMethod; label: string }[] = [
  { value: 'agencia', label: 'Por uma agência de viagens' },
  { value: 'direto', label: 'Direto no site de cada fornecedor' },
  { value: 'plataforma', label: 'Em uma plataforma de gestão' },
  { value: 'misto', label: 'Depende de quem está viajando' },
];

const PAIN_OPTIONS: { value: MainPain; label: string }[] = [
  { value: 'preco', label: 'Pagamos caro demais nas passagens' },
  { value: 'tempo', label: 'Reservar consome tempo do time' },
  { value: 'comparar', label: 'Perder tempo comparando preços' },
  { value: 'reembolso', label: 'Reembolso e notas fiscais são um caos' },
  { value: 'controle', label: 'Falta controle sobre o que é gasto' },
];

export interface QuizProps {
  onComplete: (answers: QuizAnswers, honeypot: string) => void;
  submitting: boolean;
  error: string | null;
}

export default function Quiz({ onComplete, submitting, error }: QuizProps) {
  const [step, setStep] = useState(0);

  const [tripVolume, setTripVolume] = useState<TripVolumeBand | ''>('');
  const [bookingMethod, setBookingMethod] = useState<BookingMethod | ''>('');
  const [mainPain, setMainPain] = useState<MainPain | ''>('');
  const [monthlySpend, setMonthlySpend] = useState<MonthlySpendBand | ''>('');
  const [howHeard, setHowHeard] = useState<string>('');

  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);

  const [firstName, setFirstName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  function advance() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function pick<T>(setter: (v: T) => void, value: T) {
    setter(value);
    window.setTimeout(advance, 180);
  }

  const routeValid = origin !== null && destination !== null && origin.code !== destination.code;

  const finalStepValid =
    firstName.trim().length >= 2 &&
    companyName.trim().length >= 2 &&
    isValidEmail(email) &&
    isValidPhone(phone) &&
    consent &&
    howHeard !== '';

  function handleSubmit() {
    if (
      !finalStepValid ||
      !routeValid ||
      !tripVolume ||
      !bookingMethod ||
      !mainPain ||
      !monthlySpend
    ) {
      return;
    }
    onComplete(
      {
        originCode: origin!.code,
        destinationCode: destination!.code,
        tripVolume,
        bookingMethod,
        mainPain,
        monthlySpend,
        howHeard,
        firstName: firstName.trim(),
        companyName: companyName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        consent: true,
      },
      honeypot,
    );
  }

  return (
    <div className="oc-card">
      <div
        className="oc-progress"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
      >
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className="oc-progress-step"
            data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}
          />
        ))}
      </div>

      {/* 1 — volume */}
      {step === 0 && (
        <div className="oc-question">
          <h2 className="oc-question-title">Quantas viagens a empresa faz por mês?</h2>
          <p className="oc-question-help">Uma estimativa já basta.</p>
          <div className="oc-options">
            {VOLUME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="oc-option"
                data-selected={tripVolume === opt.value}
                onClick={() => pick(setTripVolume, opt.value)}
              >
                <span>{opt.label}</span>
                <span className="oc-option-hint">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2 — método atual */}
      {step === 1 && (
        <div className="oc-question">
          <h2 className="oc-question-title">Como sua empresa reserva viagens atualmente?</h2>
          <p className="oc-question-help">Isso muda bastante o tempo que cada reserva consome.</p>
          <div className="oc-options">
            {METHOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="oc-option"
                data-selected={bookingMethod === opt.value}
                onClick={() => pick(setBookingMethod, opt.value)}
              >
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3 — dor principal */}
      {step === 2 && (
        <div className="oc-question">
          <h2 className="oc-question-title">O que mais incomoda hoje?</h2>
          <p className="oc-question-help">Escolha o que dói mais no dia a dia.</p>
          <div className="oc-options">
            {PAIN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="oc-option"
                data-selected={mainPain === opt.value}
                onClick={() => pick(setMainPain, opt.value)}
              >
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4 — gasto mensal */}
      {step === 3 && (
        <div className="oc-question">
          <h2 className="oc-question-title">Quanto a empresa gasta por mês com viagens?</h2>
          <p className="oc-question-help">Uma estimativa geral, sem precisar consultar nada.</p>
          <div className="oc-options oc-options-grid2">
            {MONTHLY_SPEND_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className="oc-option"
                data-selected={monthlySpend === opt}
                onClick={() => pick(setMonthlySpend, opt)}
              >
                <span>{opt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5 — trecho, antes da identificação */}
      {step === 4 && (
        <div className="oc-question">
          <h2 className="oc-question-title">Qual trecho sua equipe voa com mais frequência?</h2>
          <p className="oc-question-help">
            Vamos usar esse trecho para comparar o que você paga hoje com o que pagaria na Onfly.
          </p>

          <AirportSelect
            id="oc-origin"
            label="Origem"
            placeholder="Ex.: São Paulo, CGH"
            selected={origin}
            onSelect={setOrigin}
          />

          <AirportSelect
            id="oc-destination"
            label="Destino"
            placeholder="Ex.: Rio de Janeiro, SDU"
            selected={destination}
            onSelect={setDestination}
          />

          {origin && destination && origin.code === destination.code ? (
            <p className="oc-error">Origem e destino precisam ser diferentes.</p>
          ) : null}

          <button
            type="button"
            className="oc-btn oc-btn-primary oc-btn-block"
            disabled={!routeValid}
            onClick={advance}
          >
            Continuar
          </button>
        </div>
      )}

      {/* 6 — identificação + como conheceu, na mesma tela: dispara o diagnóstico */}
      {step === 5 && (
        <div className="oc-question">
          <h2 className="oc-question-title">Sua cotação com diagnóstico está pronta!</h2>
          <p className="oc-question-help">
            Só falta seu contato para liberar o resultado. Uma cópia vai para o seu e-mail.
          </p>

          {error ? <p className="oc-error">{error}</p> : null}

          <div className="oc-field">
            <label className="oc-label" htmlFor="oc-firstname">
              Nome
            </label>
            <input
              id="oc-firstname"
              className="oc-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              placeholder="Como podemos te chamar"
            />
          </div>

          <div className="oc-field">
            <label className="oc-label" htmlFor="oc-company">
              Nome da empresa
            </label>
            <input
              id="oc-company"
              className="oc-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
              placeholder="Razão social ou nome fantasia"
            />
          </div>

          <div className="oc-field">
            <label className="oc-label" htmlFor="oc-email">
              E-mail corporativo
            </label>
            <input
              id="oc-email"
              className="oc-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="voce@empresa.com.br"
            />
          </div>

          <div className="oc-field">
            <label className="oc-label" htmlFor="oc-phone">
              Celular
            </label>
            <input
              id="oc-phone"
              className="oc-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              autoComplete="tel"
              inputMode="numeric"
              placeholder="(31) 99999-9999"
            />
          </div>

          <div className="oc-field">
            <label className="oc-label" htmlFor="oc-how-heard">
              Por onde você conheceu a Onfly?
            </label>
            <select
              id="oc-how-heard"
              className="oc-select"
              value={howHeard}
              onChange={(e) => setHowHeard(e.target.value)}
            >
              <option value="">Selecione</option>
              {HOW_HEARD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Honeypot: invisível para humanos, irresistível para bots. */}
          <div className="oc-honeypot" aria-hidden="true">
            <label htmlFor="oc-hp">Website</label>
            <input
              id="oc-hp"
              name={HONEYPOT_FIELD}
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <label className="oc-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Autorizo a Onfly a usar meus dados para enviar este diagnóstico e comunicações
              relacionadas, conforme a{' '}
              <a
                href="https://www.onfly.com.br/politica-de-privacidade/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Política de Privacidade
              </a>
              .
            </span>
          </label>

          <button
            type="button"
            className="oc-btn oc-btn-primary oc-btn-block"
            disabled={!finalStepValid || submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Calculando…' : 'Ver meu diagnóstico'}
          </button>
        </div>
      )}

      {step > 0 && !submitting ? (
        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            className="oc-btn oc-btn-ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Voltar
          </button>
        </div>
      ) : null}
    </div>
  );
}

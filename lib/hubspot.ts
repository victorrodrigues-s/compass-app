import type { QuizAnswers, CompassReport } from '@/lib/types';

/**
 * Integração com a Forms API v3 do HubSpot.
 *
 * SÓ EXISTE UM FORMULÁRIO (HUBSPOT_FORM_ID_STEP1). As três chamadas abaixo
 * enviam para o MESMO form ID:
 *
 *   submitStep1                — dispara ao gerar o report, com tudo do quiz.
 *   submitSpecialistInterest   — clique em "falar com especialista".
 *   submitTrialInterest        — envio do CNPJ no "testar grátis".
 *
 * O HubSpot casa pelo e-mail: a segunda e terceira chamadas ATUALIZAM o mesmo
 * contato criado na primeira, não criam um novo. Por isso cada uma manda só
 * os campos que tem de novo — não precisa repetir nome, telefone etc.
 *
 * ATENÇÃO: a API rejeita campos que não existem na definição do formulário.
 * Cada `name` abaixo precisa existir como campo do form E como propriedade de
 * contato no portal. `compass_gasto_mensal` e `compass_como_conheceu` parecem
 * ser propriedades JÁ EXISTENTES no seu HubSpot (os prints batem com dropdowns
 * que vocês já usam) — confirme o nome interno real dessas duas antes de
 * apontar as env vars, porque se eu inventei o nome errado, a submissão
 * inteira quebra silenciosamente.
 */

const HUBSPOT_BASE_URL = process.env.HUBSPOT_BASE_URL ?? 'https://api.hsforms.com';

type HubSpotField = { objectTypeId: string; name: string; value: string };

interface SubmitContext {
  hutk?: string;
  ipAddress?: string;
  pageUri?: string;
  pageName?: string;
}

const CONTACT = '0-1';

function field(name: string, value: string | number | undefined | null): HubSpotField | null {
  if (value === undefined || value === null || value === '') return null;
  return { objectTypeId: CONTACT, name, value: String(value) };
}

async function submitForm(
  fields: (HubSpotField | null)[],
  context: SubmitContext,
  consentText?: string,
): Promise<void> {
  const portalId = process.env.HUBSPOT_PORTAL_ID;
  const formId = process.env.HUBSPOT_FORM_ID_STEP1;
  if (!portalId) throw new Error('HUBSPOT_PORTAL_ID ausente');
  if (!formId) throw new Error('HUBSPOT_FORM_ID_STEP1 ausente');

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const path = token
    ? `/submissions/v3/integration/secure/submit/${portalId}/${formId}`
    : `/submissions/v3/integration/submit/${portalId}/${formId}`;

  const body: Record<string, unknown> = {
    submittedAt: Date.now(),
    fields: fields.filter((f): f is HubSpotField => f !== null),
    context: {
      hutk: context.hutk,
      ipAddress: context.ipAddress,
      pageUri: context.pageUri,
      pageName: context.pageName,
    },
  };

  if (consentText) {
    body.legalConsentOptions = {
      consent: { consentToProcess: true, text: consentText },
    };
  }

  const res = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[hubspot] submissão falhou', {
      status: res.status,
      detail: detail.slice(0, 500),
    });
    throw new Error(`HubSpot respondeu ${res.status}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Submissão 1 — quiz completo, ao gerar o report
// ─────────────────────────────────────────────────────────────────────────────

const CONSENT_TEXT =
  'Autorizo a Onfly a armazenar e tratar meus dados para envio do diagnóstico e comunicações relacionadas.';

export async function submitStep1(
  answers: QuizAnswers,
  report: CompassReport,
  context: SubmitContext,
): Promise<void> {
  await submitForm(
    [
      field('email', answers.email),
      field('firstname', answers.firstName),
      field('phone', answers.phone),
      field('compass_origem_voo', answers.originCode),
      field('compass_destino_voo', answers.destinationCode),
      field('compass_volume_viagens', answers.tripVolume),
      field('compass_metodo_reserva', answers.bookingMethod),
      field('compass_dor_principal', answers.mainPain),
      field('compass_gasto_mensal', answers.monthlySpend),
      field('compass_como_conheceu', answers.howHeard),
      field('compass_economia_anual', (report.projection.annualSavingsCents / 100).toFixed(2)),
      field('compass_horas_economizadas', report.projection.hoursSavedPerYear),
    ],
    context,
    CONSENT_TEXT,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Submissão 2 — clique em "falar com especialista"
// ─────────────────────────────────────────────────────────────────────────────

export async function submitSpecialistInterest(
  email: string,
  context: SubmitContext,
): Promise<void> {
  await submitForm(
    [field('email', email), field('compass_caminho', 'especialista')],
    context,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Submissão 3 — CNPJ no "testar grátis"
// ─────────────────────────────────────────────────────────────────────────────

export async function submitTrialInterest(
  email: string,
  cnpj: string,
  context: SubmitContext,
): Promise<void> {
  await submitForm(
    [field('email', email), field('compass_cnpj', cnpj), field('compass_caminho', 'trial')],
    context,
  );
}

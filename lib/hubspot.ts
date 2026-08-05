import { BOOKING_METHOD_LABELS, TRIP_VOLUME_LABELS, type QuizAnswers } from '@/lib/types';

/**
 * Integração com a Forms API v3 do HubSpot.
 *
 * SÓ EXISTE UM FORMULÁRIO (HUBSPOT_FORM_ID_STEP1). As três chamadas abaixo
 * enviam para o MESMO form ID; o HubSpot casa pelo e-mail e atualiza o mesmo
 * contato, nunca cria um novo.
 *
 * TODAS as propriedades abaixo JÁ EXISTEM no portal — confirmadas via API do
 * HubSpot em 05/08/2026, não por print. Nenhuma propriedade nova é criada.
 * Deliberadamente NÃO enviamos: aeroporto de origem/destino, dor principal,
 * economia anual projetada, horas economizadas e o caminho escolhido — não
 * têm propriedade correspondente e o time optou por não criar uma agora.
 * Esses dados continuam existindo no relatório mostrado na tela, só não vão
 * para o CRM.
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

export async function submitStep1(answers: QuizAnswers, context: SubmitContext): Promise<void> {
  await submitForm(
    [
      field('email', answers.email),
      field('firstname', answers.firstName),
      field('phone', answers.phone),
      field('company', answers.companyName),
      // Campos de texto livre no HubSpot: mandamos rótulo legível, não o código interno.
      field('quantas_viagens_sua_empresa_faz_por_ms', TRIP_VOLUME_LABELS[answers.tripVolume]),
      field('usa_alguma_agncia_de_viagem_', BOOKING_METHOD_LABELS[answers.bookingMethod]),
      // Enumeração: o valor já é o valor real do HubSpot (validado contra a API).
      field('gmv_empresa', answers.monthlySpend),
      field('self_attribution_message', answers.howHeard),
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
  // Sem propriedade para registrar "qual caminho" (não criamos uma nova), então
  // essa submissão só reforça/atualiza o contato pelo e-mail já conhecido.
  await submitForm([field('email', email)], context);
}

// ─────────────────────────────────────────────────────────────────────────────
// Submissão 3 — CNPJ no "testar grátis"
// ─────────────────────────────────────────────────────────────────────────────

export async function submitTrialInterest(
  email: string,
  cnpj: string,
  context: SubmitContext,
): Promise<void> {
  // ATENÇÃO: a propriedade "cnpj" no HubSpot é do tipo Número, não Texto.
  // Um CNPJ que comece com zero perde o dígito à esquerda ao ser armazenado
  // como número — isso é a configuração da propriedade, não algo que dá para
  // contornar por aqui.
  await submitForm([field('email', email), field('cnpj', cnpj)], context);
}

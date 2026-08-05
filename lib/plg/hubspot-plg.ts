import { mapMonthlySpendToPlg } from '@/lib/plg/spend-map';
import type { MonthlySpendBand } from '@/lib/types';

/**
 * Integração com o formulário e o workflow de aprovação do onfly-joyride-flow.
 *
 * DELIBERADAMENTE um formulário e (possivelmente) um portal do HubSpot
 * SEPARADOS do HUBSPOT_FORM_ID_STEP1 usado pelo resto do Compass — não é
 * bug, foi confirmado que esse fluxo de aprovação PLG usa form próprio (ver
 * projeto.md do onfly-joyride-flow). Env vars próprias:
 *   HUBSPOT_PLG_PORTAL_ID, HUBSPOT_PLG_FORM_ID
 * Pra leitura via CRM Search API (polling), reusa HUBSPOT_PRIVATE_APP_TOKEN
 * se HUBSPOT_PLG_PRIVATE_APP_TOKEN não estiver definida — só funciona se o
 * app privado tiver acesso ao portal certo; confirme antes de ir pra
 * produção.
 */

const HUBSPOT_FORMS_BASE_URL = process.env.HUBSPOT_BASE_URL ?? 'https://api.hsforms.com';
const HUBSPOT_API_BASE_URL = 'https://api.hubapi.com';

type PlgField = { objectTypeId: '0-1' | '0-2'; name: string; value: string };

function field(
  objectTypeId: '0-1' | '0-2',
  name: string,
  value: string | undefined | null,
): PlgField | null {
  if (value === undefined || value === null || value === '') return null;
  return { objectTypeId, name, value: String(value) };
}

export interface PlgForm1Data {
  fullName: string;
  email: string;
  phone: string;
  cnpj: string;
  companyName: string;
  monthlySpend: MonthlySpendBand;
}

interface SubmitContext {
  hutk?: string;
  pageUri?: string;
  pageName?: string;
}

/**
 * Submissão 1 do fluxo PLG — dispara o workflow de aprovação no HubSpot.
 * O campo `iniciar_fluxo_de_aprovacao_do_plg` é o gatilho: sem ele, o
 * workflow do lado do HubSpot não roda (ver projeto.md).
 */
export async function submitPlgForm1(data: PlgForm1Data, context: SubmitContext): Promise<void> {
  const portalId = process.env.HUBSPOT_PLG_PORTAL_ID;
  const formId = process.env.HUBSPOT_PLG_FORM_ID;
  if (!portalId) throw new Error('HUBSPOT_PLG_PORTAL_ID ausente');
  if (!formId) throw new Error('HUBSPOT_PLG_FORM_ID ausente');

  const token = process.env.HUBSPOT_PLG_PRIVATE_APP_TOKEN ?? process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const path = token
    ? `/submissions/v3/integration/secure/submit/${portalId}/${formId}`
    : `/submissions/v3/integration/submit/${portalId}/${formId}`;

  const fields: (PlgField | null)[] = [
    field('0-1', 'nome_completo', data.fullName),
    field('0-1', 'email', data.email),
    field('0-1', 'phone', data.phone),
    field('0-2', 'cnpj', data.cnpj),
    field('0-1', 'company', data.companyName),
    field('0-2', 'n10k_em_viagens', mapMonthlySpendToPlg(data.monthlySpend)),
    field('0-1', 'iniciar_fluxo_de_aprovacao_do_plg', 'true'),
  ];

  const res = await fetch(`${HUBSPOT_FORMS_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      submittedAt: Date.now(),
      fields: fields.filter((f): f is PlgField => f !== null),
      context: {
        hutk: context.hutk,
        pageUri: context.pageUri,
        pageName: context.pageName,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[plg] submissão do form1 falhou', { status: res.status, detail: detail.slice(0, 500) });
    throw new Error(`HubSpot (PLG) respondeu ${res.status}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Polling de aprovação
// ─────────────────────────────────────────────────────────────────────────

/**
 * Valores possíveis de `aprovada_no_onfly_lite` (propriedade Company,
 * internal name confirmado no projeto.md). Mantidos exatamente como estão
 * documentados lá — não são meu palpite.
 */
const APPROVED_VALUES = ['Aprovada', 'Cadastrada', 'Habilitada'];

export const DENIAL_MESSAGES: Record<string, string> = {
  'Cnpj Inválido': 'O CNPJ informado não é válido. Verifique os dígitos e tente novamente.',
  'Cnpj Inativo': 'O CNPJ informado está inativo na Receita Federal.',
  'É MEI': 'O acesso gratuito não está disponível para MEI no momento.',
  'Empresa criada a menos de 2 meses':
    'Sua empresa deve ter pelo menos 2 meses de atividade para acessar a plataforma.',
  'Agência de Viagens': 'O acesso gratuito não está disponível para agências de viagens.',
  'Domínio com menos de 2 meses':
    'O domínio do seu e-mail corporativo tem menos de 2 meses. Aguarde e tente novamente.',
  'E-mail corporativo fornecido diferente do encontrado na Receita':
    'O domínio do seu e-mail não corresponde ao registrado na Receita Federal para este CNPJ.',
};

export type PlgApprovalCheck =
  | { state: 'pending' }
  | { state: 'approved' }
  | { state: 'denied'; reasonRaw: string; message: string }
  | { state: 'unknown'; reasonRaw: string };

/**
 * Busca a company pelo CNPJ via CRM Search API (não é a Forms API) e lê
 * `aprovada_no_onfly_lite`. Precisa de token com escopo de leitura de
 * companies no portal onde esse fluxo roda.
 */
export async function checkPlgApproval(cnpjOnlyDigits: string): Promise<PlgApprovalCheck> {
  const token = process.env.HUBSPOT_PLG_PRIVATE_APP_TOKEN ?? process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) throw new Error('HUBSPOT_PLG_PRIVATE_APP_TOKEN (ou HUBSPOT_PRIVATE_APP_TOKEN) ausente');

  const res = await fetch(`${HUBSPOT_API_BASE_URL}/crm/v3/objects/companies/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filterGroups: [
        { filters: [{ propertyName: 'cnpj', operator: 'EQ', value: cnpjOnlyDigits }] },
      ],
      properties: ['aprovada_no_onfly_lite'],
      limit: 1,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[plg] busca de aprovação falhou', { status: res.status, detail: detail.slice(0, 500) });
    throw new Error(`HubSpot (PLG search) respondeu ${res.status}`);
  }

  const data = await res.json();
  const status: string | undefined = data?.results?.[0]?.properties?.aprovada_no_onfly_lite;

  if (!status) return { state: 'pending' };
  if (APPROVED_VALUES.includes(status)) return { state: 'approved' };
  if (status in DENIAL_MESSAGES) {
    return { state: 'denied', reasonRaw: status, message: DENIAL_MESSAGES[status] };
  }
  return { state: 'unknown', reasonRaw: status };
}

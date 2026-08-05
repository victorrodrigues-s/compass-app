/**
 * Chamadas às APIs da própria plataforma Onfly (não HubSpot) — criação e
 * habilitação de empresa, criação do User Master. Baseado no projeto.md do
 * onfly-joyride-flow.
 *
 * MUDANÇA DELIBERADA em relação à referência: no onfly-joyride-flow essas
 * chamadas rodam NO FRONT (client-side), o que expõe as API keys no
 * navegador. Aqui elas só rodam em rotas de API do Next.js (server-side) —
 * mesmo padrão que o resto do Compass já usa pra HubSpot/Ignav. As chaves
 * (ONFLY_API_KEY, ONFLY_EDIT_COMPANY_KEY, ONFLY_EMPLOYEE_API_KEY) nunca
 * devem ser lidas em código que roda no browser.
 *
 * PONTOS NÃO CONFIRMADOS — o próprio projeto.md marca isso, não é
 * interpretação minha:
 *   1. O payload exato de POST /register/company não está documentado —
 *      só o formato do RETORNO. Montei um payload plausível a partir dos
 *      dados que já temos (nome, cnpj, telefone, e-mail); confirme com o
 *      time antes de ir pra produção.
 *   2. O header de autenticação de /employee-create e /employee-create/…
 *      /preferences está marcado como "🟡 Em verificação" no projeto.md
 *      original — implementei com Bearer (ONFLY_EMPLOYEE_API_KEY) por ser
 *      o padrão mais comum, mas isso é um CHUTE até alguém confirmar.
 */

const ONFLY_API_BASE_URL = 'https://api.onfly.com';
const ONFLY_EDIT_COMPANY_URL = 'https://onfly-company-edit-995842140099.us-central1.run.app/edit-company';

export interface RegisterCompanyInput {
  companyName: string;
  cnpj: string;
  phone: string;
  email: string;
  contactName: string;
}

export interface RegisterCompanyResult {
  onflyCompanyId: number;
  userId: number;
  hash: string;
}

/**
 * POST /register/company — payload NÃO confirmado (ver aviso no topo do
 * arquivo). Ajuste os nomes de campo assim que tiver a especificação real.
 */
export async function registerCompany(input: RegisterCompanyInput): Promise<RegisterCompanyResult> {
  const apiKey = process.env.ONFLY_API_KEY;
  if (!apiKey) throw new Error('ONFLY_API_KEY ausente');

  const res = await fetch(`${ONFLY_API_BASE_URL}/register/company`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    // TODO: payload não documentado no projeto.md — confirmar campos reais.
    body: JSON.stringify({
      fantasyName: input.companyName,
      socialName: input.companyName,
      cnpj: input.cnpj,
      mainPhone: input.phone,
      email: input.email,
      contactName: input.contactName,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[plg] registerCompany falhou', { status: res.status, detail: detail.slice(0, 500) });
    throw new Error(`Onfly register/company respondeu ${res.status}`);
  }

  const data = await res.json();
  const company = data?.company;
  if (!company?.id || !company?.firstEmployee?.id || !company?.firstEmployee?.hash) {
    console.error('[plg] registerCompany retornou formato inesperado', data);
    throw new Error('Resposta de register/company sem os campos esperados (id, firstEmployee.id/hash)');
  }

  return {
    onflyCompanyId: company.id,
    userId: company.firstEmployee.id,
    hash: company.firstEmployee.hash,
  };
}

export interface EditCompanyInput {
  onflyCompanyId: number;
  cnpj: string;
  financialEmail: string;
}

/** POST /edit-company — payload confirmado, direto do projeto.md. */
export async function editCompany(input: EditCompanyInput): Promise<void> {
  const apiKey = process.env.ONFLY_EDIT_COMPANY_KEY;
  if (!apiKey) throw new Error('ONFLY_EDIT_COMPANY_KEY ausente');

  const res = await fetch(ONFLY_EDIT_COMPANY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      company_id: String(input.onflyCompanyId),
      cnpj: input.cnpj,
      status: 'ativar',
      financial_email: input.financialEmail,
      plan: '1',
      cs_responsible: '593163',
      category: 'Small',
      attention_points: 'Acesso Gratuito',
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[plg] editCompany falhou', { status: res.status, detail: detail.slice(0, 500) });
    throw new Error(`Onfly edit-company respondeu ${res.status}`);
  }
}

export interface CreateEmployeeInput {
  hash: string;
  userId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  companyName: string;
  birthday: string; // YYYY-MM-DD
  gender: 'male' | 'female';
  password: string;
  passwordConfirm: string;
  cpfFormatted: string; // XXX.XXX.XXX-XX
  cpfDigitsOnly: string;
}

function employeePayload(input: CreateEmployeeInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    name: input.fullName,
    email: input.email,
    company: input.companyName,
    birthday: input.birthday,
    gender: input.gender,
    password: input.password,
    passwordConfirm: input.passwordConfirm,
    cpf: input.cpfFormatted,
    hasLoginRestriction: false,
    firstLogin: 1,
    id: String(input.userId),
    document: { value: input.cpfDigitsOnly, type: 1 },
    passport: null,
    nationality: null,
    cellphone: null,
    landlinePhone: null,
    personalEmail: null,
    rgNumber: null,
    keyPix: null,
    typeKeyPix: null,
    preferredRoom: null,
    preferredFloor: null,
    preferredSeat: null,
    city: null,
    uf: null,
    number: null,
    address: null,
    district: null,
    postCode: null,
  };
}

/**
 * Cabeçalho de auth NÃO confirmado — ver aviso no topo do arquivo.
 * Exportada separada de createEmployeePreferences pra quem chamar poder
 * disparar as duas em paralelo com Promise.all, como o projeto.md pede.
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<void> {
  const apiKey = process.env.ONFLY_EMPLOYEE_API_KEY;
  if (!apiKey) throw new Error('ONFLY_EMPLOYEE_API_KEY ausente');

  const res = await fetch(`${ONFLY_API_BASE_URL}/employee-create/${input.hash}/${input.userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(employeePayload(input)),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[plg] createEmployee falhou', { status: res.status, detail: detail.slice(0, 500) });
    throw new Error(`Onfly employee-create respondeu ${res.status}`);
  }
}

export async function createEmployeePreferences(input: CreateEmployeeInput): Promise<void> {
  const apiKey = process.env.ONFLY_EMPLOYEE_API_KEY;
  if (!apiKey) throw new Error('ONFLY_EMPLOYEE_API_KEY ausente');

  const res = await fetch(
    `${ONFLY_API_BASE_URL}/employee-create/${input.hash}/${input.userId}/preferences`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(employeePayload(input)),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[plg] createEmployeePreferences falhou', { status: res.status, detail: detail.slice(0, 500) });
    throw new Error(`Onfly employee-create/preferences respondeu ${res.status}`);
  }
}

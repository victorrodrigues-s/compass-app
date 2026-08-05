/**
 * Validações específicas do fluxo PLG (onfly-joyride-flow) — CPF, senha do
 * User Master e e-mail corporativo. Ficam separadas de lib/validation.ts
 * porque são regras de OUTRO formulário/fluxo, não do quiz do Compass.
 */

/** Formata progressivamente: 123.456.789-01 */
export function formatCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function cpfDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Valida CPF pelos dígitos verificadores (mesmo espírito de isValidCnpj em
 * lib/validation.ts — checagem real, não só contagem de dígitos).
 */
export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (slice: string): number => {
    let sum = 0;
    let weight = slice.length + 1;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * weight--;
    }
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };

  const first = checkDigit(cpf.slice(0, 9));
  if (first !== Number(cpf[9])) return false;

  const second = checkDigit(cpf.slice(0, 10));
  return second === Number(cpf[10]);
}

/**
 * Bloqueia provedores de e-mail pessoal/gratuito — o projeto.md do
 * joyride-flow exige e-mail corporativo (é um dos motivos de reprovação:
 * "E-mail corporativo fornecido diferente do encontrado na Receita").
 * Lista igual à referência: gmail, outlook, hotmail, yahoo.
 */
const FREE_EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'yahoo.com.br'];

export function isCorporateEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return false;
  return !FREE_EMAIL_DOMAINS.includes(domain);
}

/**
 * Regras de senha do User Master (baseado no exemplo do projeto.md:
 * "Teste123." — mínimo 8, maiúscula, minúscula, número, símbolo).
 * Retorna a lista de regras NÃO atendidas — vazio = senha válida. Formato
 * pensado pra alimentar mensagem de erro no campo, não só true/false.
 */
export interface PasswordRuleResult {
  rule: string;
  message: string;
  met: boolean;
}

export function checkPasswordRules(password: string): PasswordRuleResult[] {
  return [
    { rule: 'length', message: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { rule: 'upper', message: 'Pelo menos uma letra maiúscula', met: /[A-Z]/.test(password) },
    { rule: 'lower', message: 'Pelo menos uma letra minúscula', met: /[a-z]/.test(password) },
    { rule: 'number', message: 'Pelo menos um número', met: /[0-9]/.test(password) },
    { rule: 'symbol', message: 'Pelo menos um símbolo', met: /[^a-zA-Z0-9]/.test(password) },
  ];
}

export function isValidPassword(password: string): boolean {
  return checkPasswordRules(password).every((r) => r.met);
}

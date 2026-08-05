/**
 * Validações compartilhadas entre cliente e servidor.
 *
 * O cliente usa para habilitar/desabilitar botão; o servidor revalida tudo,
 * porque validação de front é conveniência, não segurança.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Celular brasileiro: 10 dígitos (fixo com DDD) ou 11 (celular com DDD). */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

/** Formata progressivamente enquanto digita: (31) 99999-9999 */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Formata progressivamente: 12.345.678/0001-95 */
export function formatCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Valida CNPJ pelos dígitos verificadores, não só pelo tamanho.
 *
 * Vale o esforço: sem isso, "00000000000000" e qualquer sequência de 14
 * dígitos entram na base como empresa válida, e alguém no comercial perde
 * tempo tentando abrir conta com um cadastro inexistente.
 */
export function isValidCnpj(value: string): boolean {
  const cnpj = value.replace(/\D/g, '');

  if (cnpj.length !== 14) return false;
  // Todos os dígitos iguais passam na conta dos verificadores, mas não existem.
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const checkDigit = (slice: string): number => {
    let weight = slice.length - 7;
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * weight--;
      if (weight < 2) weight = 9;
    }
    const result = sum % 11;
    return result < 2 ? 0 : 11 - result;
  };

  const first = checkDigit(cnpj.slice(0, 12));
  if (first !== Number(cnpj[12])) return false;

  const second = checkDigit(cnpj.slice(0, 13));
  return second === Number(cnpj[13]);
}

/** Normaliza para o formato que vai ao HubSpot: só dígitos. */
export function cnpjDigits(value: string): string {
  return value.replace(/\D/g, '');
}

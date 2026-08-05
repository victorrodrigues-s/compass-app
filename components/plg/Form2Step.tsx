'use client';

import { useState } from 'react';
import { checkPasswordRules, formatCpf, isValidCpf, isValidPassword } from '@/lib/plg/validators';

interface Form2StepProps {
  hash: string;
  userId: number;
  fullName: string;
  email: string;
  companyName: string;
  onSuccess: () => void;
}

/** "João da Silva Souza" → { firstName: "João", lastName: "da Silva Souza" } */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Etapa 5 do projeto.md — dados do User Master. Nome e e-mail vêm
 * pré-preenchidos do que já foi coletado antes (etapa 1 do fluxo PLG);
 * aqui só editáveis se a divisão automática entre nome/sobrenome ficar
 * errada.
 */
export default function Form2Step({ hash, userId, fullName, email, companyName, onSuccess }: Form2StepProps) {
  const initialSplit = splitName(fullName);
  const [firstName, setFirstName] = useState(initialSplit.firstName);
  const [lastName, setLastName] = useState(initialSplit.lastName);
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cpfComplete = cpf.replace(/\D/g, '').length === 11;
  const cpfOk = isValidCpf(cpf);
  const passwordRules = checkPasswordRules(password);
  const passwordsMatch = password.length > 0 && password === passwordConfirm;

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(birthday) &&
    gender !== null &&
    cpfOk &&
    isValidPassword(password) &&
    passwordsMatch &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/plg/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hash,
          userId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullName,
          email,
          companyName,
          birthday,
          gender,
          cpf,
          password,
          passwordConfirm,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Não conseguimos criar sua conta. Tente novamente.');
        return;
      }
      onSuccess();
    } catch {
      setError('Falha de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="oc-card oc-question">
      <p className="oc-eyebrow">Quase lá</p>
      <h2 className="oc-question-title" style={{ marginTop: 8 }}>
        Só mais alguns dados pra criar seu acesso
      </h2>

      {error ? <p className="oc-error">{error}</p> : null}

      <div className="oc-field">
        <label className="oc-label" htmlFor="oc-plg-firstname">
          Nome
        </label>
        <input
          id="oc-plg-firstname"
          className="oc-input"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
      </div>

      <div className="oc-field">
        <label className="oc-label" htmlFor="oc-plg-lastname">
          Sobrenome
        </label>
        <input
          id="oc-plg-lastname"
          className="oc-input"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>

      <div className="oc-field">
        <label className="oc-label" htmlFor="oc-plg-birthday">
          Data de nascimento
        </label>
        <input
          id="oc-plg-birthday"
          className="oc-input"
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
        />
      </div>

      <div className="oc-field">
        <span className="oc-label">Gênero</span>
        <div className="oc-options" style={{ marginTop: 6 }}>
          <button
            type="button"
            className="oc-option"
            aria-pressed={gender === 'female'}
            onClick={() => setGender('female')}
            style={gender === 'female' ? { borderColor: 'var(--oc-blue)' } : undefined}
          >
            Feminino
          </button>
          <button
            type="button"
            className="oc-option"
            aria-pressed={gender === 'male'}
            onClick={() => setGender('male')}
            style={gender === 'male' ? { borderColor: 'var(--oc-blue)' } : undefined}
          >
            Masculino
          </button>
        </div>
      </div>

      <div className="oc-field">
        <label className="oc-label" htmlFor="oc-plg-cpf">
          CPF
        </label>
        <input
          id="oc-plg-cpf"
          className="oc-input"
          value={cpf}
          onChange={(e) => setCpf(formatCpf(e.target.value))}
          inputMode="numeric"
          placeholder="000.000.000-00"
        />
        {cpfComplete && !cpfOk ? (
          <span style={{ fontSize: 13, color: 'var(--oc-red)' }}>Esse CPF não confere. Verifique os números.</span>
        ) : null}
      </div>

      <div className="oc-field">
        <label className="oc-label" htmlFor="oc-plg-password">
          Senha
        </label>
        <input
          id="oc-plg-password"
          className="oc-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        {password.length > 0 ? (
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
            {passwordRules.map((r) => (
              <li key={r.rule} style={{ color: r.met ? 'var(--oc-green)' : 'var(--oc-ink-3)' }}>
                {r.met ? '✓ ' : '· '}
                {r.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="oc-field">
        <label className="oc-label" htmlFor="oc-plg-password-confirm">
          Confirmar senha
        </label>
        <input
          id="oc-plg-password-confirm"
          className="oc-input"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          autoComplete="new-password"
        />
        {passwordConfirm.length > 0 && !passwordsMatch ? (
          <span style={{ fontSize: 13, color: 'var(--oc-red)' }}>As senhas não coincidem.</span>
        ) : null}
      </div>

      <button
        type="button"
        className="oc-btn oc-btn-primary oc-btn-block"
        disabled={!canSubmit}
        onClick={handleSubmit}
        style={{ marginTop: 8 }}
      >
        {submitting ? 'Criando conta…' : 'Criar minha conta'}
      </button>
    </div>
  );
}

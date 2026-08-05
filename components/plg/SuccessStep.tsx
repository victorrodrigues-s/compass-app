'use client';

interface SuccessStepProps {
  email: string;
}

const ONFLY_LOGIN_URL = 'https://app.onfly.com.br';

/** Etapa final — "Tela de Sucesso — acesso liberado" do projeto.md. */
export default function SuccessStep({ email }: SuccessStepProps) {
  return (
    <div className="oc-card oc-success">
      <div className="oc-success-mark" aria-hidden="true">
        ✓
      </div>
      <h2 className="oc-h2">Sua conta está pronta</h2>
      <p className="oc-lead" style={{ maxWidth: '46ch', margin: '8px auto 0' }}>
        Já dá pra entrar com {email} e a senha que você acabou de criar.
      </p>
      <div style={{ marginTop: 24 }}>
        <a
          className="oc-btn oc-btn-primary"
          href={ONFLY_LOGIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-block', textDecoration: 'none' }}
        >
          Ir para o login
        </a>
      </div>
    </div>
  );
}

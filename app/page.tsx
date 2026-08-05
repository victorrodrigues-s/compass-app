import CompassFlow from '@/components/CompassFlow';

/**
 * A LP. Server component fino: só lê configuração de ambiente e entrega para o
 * fluxo interativo.
 *
 * Se essa página for embedada dentro da LP institucional em vez de virar a
 * página inteira, o único componente necessário é <CompassFlow />.
 */
export default function Page() {
  const trialUrl = process.env.NEXT_PUBLIC_TRIAL_URL ?? 'https://app.onfly.com.br/cadastro';

  return (
    <main className="oc-shell">
      <CompassFlow trialUrl={trialUrl} />
    </main>
  );
}

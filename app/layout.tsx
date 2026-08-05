import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Onfly Compass — quanto sua empresa economiza em viagens',
  description:
    'Responda cinco perguntas e veja, com números, quanto a sua empresa deixa na mesa em viagens corporativas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hubspotPortalId = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID;

  return (
    <html lang="pt-BR">
      <head>
        {/*
          Fontes carregadas pelo NAVEGADOR, não pelo servidor.

          A versão anterior usava `next/font/google`, que baixa os arquivos de
          fonte durante a compilação. Numa rede que bloqueia fonts.googleapis.com
          (corporativa, VPN, proxy), isso trava o dev server sem mensagem de erro.

          Aqui, se as fontes não carregarem, o navegador usa a pilha de fallback
          definida no globals.css e a página funciona normalmente. Carregar
          tipografia nunca deve poder derrubar a aplicação.

          Nota de LGPD: este método faz o navegador do usuário chamar o Google,
          expondo o IP dele. Antes de ir para produção com tráfego real, vale
          hospedar os .woff2 em /public e trocar por um @font-face local.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Roboto:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}

        {/*
          Script de tracking do HubSpot. Ele grava o cookie `hubspotutk`, que as
          rotas de API leem e enviam como `hutk` — é o que liga a submissão do
          formulário à navegação do visitante no HubSpot. Sem ele, o lead chega
          sem origem de campanha.
        */}
        {hubspotPortalId ? (
          <Script
            id="hs-script-loader"
            strategy="afterInteractive"
            src={`https://js.hs-scripts.com/${hubspotPortalId}.js`}
          />
        ) : null}
      </body>
    </html>
  );
}

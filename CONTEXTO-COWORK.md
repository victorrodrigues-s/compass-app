# Onfly Compass — Contexto para retomada no Cowork

Documento de handoff. Objetivo: dar contexto completo do projeto, decisões
tomadas, estado atual e pendências, para retomar o trabalho sem perder nada
do que já foi construído e testado.

## O que é o projeto

Quiz interativo em landing page para a Onfly (plataforma de gestão de
viagens corporativas B2B). O visitante responde 6 perguntas, o app busca a
tarifa REAL de um trecho aéreo via API pública (Ignav), calcula quanto a
empresa economizaria usando a Onfly, e mostra um diagnóstico personalizado
com dois caminhos de conversão: falar com um especialista ou testar grátis.
Cada submissão alimenta um contato no HubSpot (CRM da Onfly).

## Stack

- Next.js 16 (App Router) + TypeScript + React 19, hospedado na Vercel
- Sem banco de dados — tudo client-side + rotas de API server-side
- Fonte de tarifas: API pública da Ignav (https://ignav.com)
- CRM: HubSpot, via Forms API v3 (um único formulário)

## Onde as coisas estão

- **Código-fonte:** GitHub, `github.com/victorrodrigues-s/compass-app`
  (repositório privado do Victor)
- **Deploy:** Vercel, projeto `onfly-compass-app`, time
  `victorrodrigues-1869s-projects`. Conectado ao GitHub — todo push na branch
  `main` gera deploy automático de produção.
- **URL de produção:**
  `https://onfly-compass-app-victorrodrigues-1869s-projects.vercel.app`
  (também respondendo em `onfly-compass-app.vercel.app`)
- **Ambiente do Victor:** Windows, evita PowerShell quando possível — por
  isso o fluxo de trabalho é: eu edito o código, gero um ZIP, ele sobe os
  arquivos alterados pela interface web do GitHub (Add file → Upload files),
  o que dispara redeploy automático na Vercel.

## Estrutura de arquivos (o que existe hoje)

```
onfly-compass-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       ├── compass/route.ts     ← gera o diagnóstico (cotação + report + HubSpot)
│       ├── airports/route.ts    ← autocomplete de aeroporto
│       ├── hubspot/route.ts     ← clique em "falar com especialista"
│       └── trial/route.ts       ← CNPJ do "testar grátis"
├── components/
│   ├── CompassFlow.tsx          ← máquina de estados do funil inteiro
│   ├── Quiz.tsx                 ← as 6 telas de pergunta
│   ├── Report.tsx               ← tela de diagnóstico
│   ├── TrialForm.tsx            ← mini-form de CNPJ
│   └── AirportSelect.tsx        ← autocomplete de aeroporto
├── lib/
│   ├── types.ts                 ← contrato de dados central (QuizAnswers, CompassReport, etc.)
│   ├── compass.ts                ← regra de negócio: monta o report a partir da cotação
│   ├── hubspot.ts                ← integração com a Forms API do HubSpot
│   ├── quiz-validation.ts        ← validação compartilhada entre as 3 rotas
│   ├── guard.ts                  ← rate limit + honeypot anti-bot
│   ├── validation.ts             ← validadores (e-mail, telefone, CNPJ)
│   └── fares/
│       ├── index.ts              ← seleciona Ignav real ou stub, por env var
│       ├── ignav.ts               ← provider real (cache, filtro de metrô, etc.)
│       └── mock.ts                ← stub offline para dev sem chave de API
├── sql/build_route_benchmarks.sql  ← resquício do BigQuery, não usado mais (pode remover)
└── README.md                     ← documentação técnica completa do projeto
```

**Leia o `README.md` do projeto** — ele tem o detalhamento técnico de cada
peça (tabela de propriedades do HubSpot, como funciona o cache de tarifas,
etc.). Este documento aqui é sobre CONTEXTO E HISTÓRICO, o README é sobre
COMO O CÓDIGO FUNCIONA.

## Ordem das 6 telas do quiz

1. Quantas viagens a empresa faz por mês?
2. Como sua empresa reserva viagens atualmente?
3. O que mais incomoda hoje? (inclui "Perder tempo comparando preços")
4. Quanto a empresa gasta por mês com viagens?
5. Qual trecho sua equipe voa com mais frequência? (origem/destino, busca real de aeroporto)
6. Identificação (nome, empresa, e-mail, celular) + "por onde conheceu a Onfly" — **essa
   última tela dispara a busca de tarifa e o diagnóstico**

Depois do diagnóstico: se o gasto mensal for "Até 10 mil reais/mês", só
aparece a opção de testar grátis. Qualquer outra resposta mostra as duas
opções (falar com especialista + testar grátis).

## Decisões importantes já tomadas (não reabrir sem necessidade)

- **Só um formulário no HubSpot.** Existia um design com 3-4 formulários
  distintos; foi simplificado para um único formulário que recebe todas as
  submissões (quiz completo, clique em especialista, CNPJ do trial). O
  HubSpot casa por e-mail e atualiza o mesmo contato.
- **Caminho de indicação foi removido por completo** (existia uma versão com
  3 caminhos de conversão incluindo "indicar para minha empresa" com prêmio
  de R$500 — foi descartado, não existe mais no código).
- **Sem BigQuery.** Foi avaliado no início, descartado. Tarifas vêm 100% da
  Ignav.
- **Sem criar propriedades novas no HubSpot.** Todos os campos enviados
  mapeiam para propriedades que já existiam no portal do Victor — os nomes
  internos reais foram confirmados via API do HubSpot (não por print, que se
  mostrou não confiável — o rótulo visível diverge do valor interno em
  vários casos, ver seção HubSpot do README).
- **O que NÃO vai para o HubSpot** (fica só no relatório em tela): aeroporto
  de origem/destino, dor principal declarada, economia anual projetada,
  horas economizadas, caminho escolhido (especialista/trial). Não existe
  propriedade correspondente e o time optou por não criar.

## Bugs corrigidos recentemente (05/08/2026) — contexto de por que o código é como é

1. **Quiz "reiniciava" ao dar erro.** A máquina de estados trocava para uma
   tela cheia de "calculando", que desmontava o componente do Quiz; ao
   voltar de um erro, o React remontava do zero e perdia tudo que a pessoa
   tinha preenchido. Corrigido: agora usa um booleano `submitting` e o Quiz
   nunca desmonta durante a submissão.
2. **Busca de tarifa falhando para trechos comuns.** Log de produção mostrou
   `origin: GIG, destination: SAO, itinerariesCount: 0`. `SAO` não é um
   aeroporto — é o código de área metropolitana de São Paulo (agrupa GRU,
   CGH, VCP). A documentação da Ignav garante que a busca só devolve
   aeroportos, mas na prática vazou um código de metrô. Corrigido com um
   filtro (`METRO_CODES` em `lib/fares/ignav.ts`) que remove códigos de
   metrô conhecidos da lista de opções antes de chegar no usuário.
3. **Clique em "falar com especialista" retornando erro 400 do HubSpot.** O
   formulário no HubSpot marca `company`, `firstname` e
   `self_attribution_message` como campos OBRIGATÓRIOS — e o HubSpot valida
   isso em QUALQUER submissão àquele formulário, mesmo uma que só pretendia
   reforçar um contato já existente com um e-mail. Corrigido: as três
   submissões (quiz completo, especialista, trial) agora sempre mandam o
   conjunto base inteiro de campos, nunca dependem de saber o que está
   marcado como obrigatório no HubSpot.

## Variáveis de ambiente — o que está configurado, o que falta

Confirmado via logs de runtime da Vercel que já estão configuradas:
`HUBSPOT_FORM_ID_STEP1`, `HUBSPOT_PRIVATE_APP_TOKEN`, `HUBSPOT_PORTAL_ID`,
`IGNAV_API_KEY` (a busca de tarifa real está funcionando em produção).

Verificar se também está configurada: `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` (mesmo
valor do Portal ID, mas exposta ao browser — necessária pro script de
tracking do HubSpot que grava o cookie de atribuição de campanha; sem ela a
submissão funciona mas perde a atribuição de origem do lead).

Lista completa em `.env.example` no projeto.

## Pendências conhecidas

- [ ] Confirmar que `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` está configurada (ver acima)
- [ ] `cnpj` no HubSpot é propriedade do tipo **Número**, não Texto — CNPJ
      que comece com zero à esquerda perde o dígito ao ser armazenado. Não é
      algo que o código resolve; é a configuração da propriedade no portal.
      Só documentado, ninguém decidiu se vale a pena mudar o tipo da
      propriedade.
- [ ] `sql/build_route_benchmarks.sql` é resquício da fase BigQuery
      (descartada) — pode ser removido do projeto, ninguém usa.
- [ ] Sem testes automatizados formais — toda validação até agora foi manual
      (build + typecheck + testes funcionais ad-hoc via curl/tsx a cada
      mudança, documentados nas conversas anteriores, não persistidos como
      suíte de testes no repositório).

## Como validar mudanças antes de subir

Processo usado até aqui, útil de manter:
```bash
npm install
npx tsc --noEmit      # typecheck
npx next build         # build de produção
```
Sempre validar com uma cópia limpa (extraída do zero do ZIP/repo), não só a
pasta de trabalho — pegou mais de um bug de arquivo esquecido dessa forma.

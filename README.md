# Onfly Compass — quiz interativo com diagnóstico personalizado

Quiz de 5 perguntas que gera um diagnóstico de economia em viagens corporativas
e converte em contato com especialista. Next.js (App Router) + TypeScript,
pronto para deploy na Vercel.

Roda hoje com **dados mockados**. A troca para BigQuery é uma variável de
ambiente — nenhum componente de UI muda.

---

## Rodando local

```bash
npm install
cp .env.example .env.local   # o default já funciona: BENCHMARK_PROVIDER=mock
npm run dev
```

Abre em `http://localhost:3000`. Sem nenhuma credencial preenchida, o quiz
funciona e o report é gerado; só as submissões do HubSpot falham (com log no
servidor, sem quebrar a experiência).

---

## Arquitetura

```
Browser (quiz)
    │  POST /api/compass  { respostas do quiz }
    ▼
app/api/compass/route.ts ──── valida, aplica rate limit e honeypot
    │
    ├──> lib/benchmarks/       busca números da rota
    │      ├── mock.ts         ← ativo hoje
    │      └── bigquery.ts     ← tabela agregada, pronto para ligar
    │
    ├──> lib/compass.ts        aplica regra de negócio → CompassReport
    │
    └──> lib/hubspot.ts        dispara FORMULÁRIO 1 (captura)
    │
    ▼
components/Report.tsx          renderiza o CompassReport
    │  usuário clica em "falar com especialista"
    ▼
POST /api/hubspot ──────────> dispara FORMULÁRIO 2 (qualificação)
```

### O que sustenta essa separação

**O browser nunca fala com BigQuery nem com HubSpot.** Credencial de service
account e token de app privado só existem no servidor. As rotas de API são a
única porta de entrada.

**`lib/types.ts` é o contrato.** Quiz, fonte de dados e report se conhecem
apenas por esses tipos. Trocar mock por BigQuery não toca em UI porque
`RouteBenchmark` tem o mesmo shape nas duas implementações.

**Constantes de negócio ficam em `lib/compass.ts`.** Faixas de viagens,
fatores de atrito, custo-hora operacional e valor do crédito estão nomeados no
topo do arquivo. Quando o comercial quiser recalibrar a projeção, mexe só ali.

---

## Tarifas: como funciona

As tarifas vêm da **API pública da Ignav** (`lib/fares/ignav.ts`). O fluxo:

1. O usuário busca origem e destino (`GET /api/airports` → Ignav).
2. A rota `POST /api/compass` consulta a tarifa do trecho.
3. O **valor Onfly** é essa tarifa menos `ONFLY_DISCOUNT_PERCENT` (8,9% por padrão).

### Duas origens diferentes, e isso importa

A tarifa de mercado é **real**. O valor Onfly é **modelado** — a mesma tarifa
com o desconto aplicado. O rodapé do report diz exatamente isso. Não altere
esse texto para sugerir que ambos são medidos: além de falso, é o tipo de
afirmação que desmonta na primeira pergunta do prospect.

O tempo de reserva (43 min hoje vs 3 min na Onfly) também é premissa, não
medição — a API não fornece esse dado. Está em `lib/compass.ts`.

### Controle de custo — leia antes de ir para tráfego pago

A Ignav cobra por requisição bem-sucedida, e esta é uma LP pública. Sem
cuidado, cada visitante (e cada tecla no autocomplete) vira dinheiro. Defesas
já implementadas:

| Defesa | Onde |
|---|---|
| Cache de cotação, 12h por trecho | `lib/fares/ignav.ts` |
| Cache de busca de aeroporto, 24h | `lib/fares/ignav.ts` |
| Debounce de 350ms + mínimo de 3 letras | `components/AirportSelect.tsx` |
| Rate limit por IP | `lib/guard.ts` |
| Data de pesquisa fixa (hoje + 21 dias, dia útil) | `lib/fares/ignav.ts` |

A data fixa não é detalhe: se variasse a cada visita, dois usuários no mesmo
trecho veriam números diferentes e o cache nunca acertaria.

> **O cache é em memória, por instância serverless.** Com volume real de
> campanha, mova para Vercel KV ou Upstash Redis — senão cada instância nova
> recomeça do zero e a conta sobe.

### Sem chave de API

Se `IGNAV_API_KEY` não estiver configurada, o app cai num stub offline
(`lib/fares/mock.ts`) com preços **fictícios**, para o projeto rodar em
desenvolvimento. Isso nunca é silencioso: o servidor loga um aviso e o report
carrega `meta.source: 'mock'`.

## Configurando o formulário do HubSpot

**Só existe UM formulário.** Os três pontos de contato do funil — quiz completo,
"falar com especialista", CNPJ do "testar grátis" — submetem para o mesmo
`HUBSPOT_FORM_ID_STEP1`. O HubSpot casa pelo e-mail: a segunda e a terceira
submissão atualizam o mesmo contato criado na primeira.

**Todas as propriedades já existem no portal** — confirmadas via API do
HubSpot em 05/08/2026, não criamos nada novo:

| Campo enviado | Propriedade real no HubSpot | Tipo | Observação |
|---|---|---|---|
| `email` | `email` | texto | chave de casamento entre as 3 submissões |
| `firstname` | `firstname` | texto | |
| `phone` | `phone` | texto | |
| `company` | `company` | texto | nome da empresa, novo campo no quiz |
| `quantas_viagens_sua_empresa_faz_por_ms` | idem | **texto livre** | mandamos rótulo legível (`TRIP_VOLUME_LABELS`), não o código interno |
| `usa_alguma_agncia_de_viagem_` | idem | **texto livre** | mandamos rótulo legível (`BOOKING_METHOD_LABELS`) |
| `gmv_empresa` | idem | **enumeração** | os 6 valores do quiz já batem com os valores reais |
| `self_attribution_message` | idem | **enumeração** | ⚠️ ver abaixo — valor ≠ rótulo em vários casos |
| `cnpj` | `cnpj` | **número** | ⚠️ ver abaixo |

### `self_attribution_message` — valor ≠ rótulo

Confirmado via API, não por print. O rótulo é o texto que aparece no select;
o **valor** é o que precisa ser enviado, e diverge do rótulo em vários casos:

| Rótulo (visível) | Valor (enviado) |
|---|---|
| Aeroporto & Outdoor | `Aeroporto` |
| Instagram/Facebook/Tiktok | `Instagram/Facebook` |
| Podcast/Imprensa/Sites de notícia | `Imprensa/Sites de notícia` |
| Spotify & Rádio | `Anúncio do Spotify` |
| TV & Streaming | `TV` |
| Influenciador | `Influênciador` (acento a mais no valor) |

`HOW_HEARD_OPTIONS`, em `lib/types.ts`, já está estruturado como
`{ value, label }[]` — o componente renderiza o `label` e envia o `value`.
Se o dropdown mudar no HubSpot no futuro, atualize esse array com os valores
reais (não adivinhe pelo rótulo — foi exatamente esse erro que gerou essa nota).

### `cnpj` é do tipo Número, não Texto

Um CNPJ que comece com zero à esquerda perde esse dígito ao ser armazenado
como número. Isso é a configuração da propriedade no HubSpot, não algo que o
código resolve — vale saber que existe esse risco se um dia um CNPJ aparecer
"faltando um dígito" nos relatórios.

### O que NÃO vai para o HubSpot

Aeroporto de origem/destino, dor principal declarada, economia anual
projetada, horas economizadas e o caminho escolhido (especialista/trial) —
nenhum tem propriedade correspondente hoje e o time optou por não criar uma.
Esses dados continuam existindo no relatório mostrado na tela do usuário, só
não são persistidos no CRM.

### Comportamento em caso de falha

As duas etapas tratam erro de forma diferente, de propósito:

- **Etapa 1:** se o HubSpot falhar, o usuário **ainda vê o diagnóstico**. Ele já
  entregou os dados; punir com uma tela de erro por um problema nosso não faz
  sentido. A falha vai para o log do servidor.
- **Etapa 2:** se o HubSpot falhar, o usuário **vê o erro e pode tentar de
  novo**. Aqui ele pediu contato e precisa saber se a solicitação foi
  registrada.

---

## Deploy na Vercel

```bash
vercel
```

Configure as variáveis do `.env.example` no painel do projeto. Pontos de
atenção:

- As rotas usam `runtime = 'nodejs'` — o client do BigQuery não roda em edge.
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` vai como uma linha única (JSON inteiro).
- O rate limit em `lib/guard.ts` é **em memória, por instância**. Serve para
  barrar abuso trivial. Com tráfego real de campanha, troque por Vercel KV ou
  Upstash Redis — senão cada instância nova reinicia a contagem.

---

## Checklist antes de ir para produção

- [ ] Criar as propriedades custom e o ÚNICO formulário no HubSpot
- [ ] Confirmar o nome interno real de compass_gasto_mensal e compass_como_conheceu (provavelmente já existem)
- [ ] Conferir as opções das duas enumerações contra o HubSpot, caractere por caractere
- [ ] Preencher `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` (atribuição de campanha)
- [ ] Usar `HUBSPOT_PRIVATE_APP_TOKEN` para cair no endpoint `/secure/submit`
- [ ] Publicar a página `/privacidade` linkada no checkbox de consentimento
- [ ] Trocar o rate limit em memória por store compartilhado
- [ ] Obter a chave da Ignav e configurar IGNAV_API_KEY
- [ ] Validar o desconto de 8,9% com o comercial (hoje é premissa, não preço medido)
- [ ] Monitorar consumo da Ignav nos primeiros dias de tráfego
- [ ] Instrumentar o funil (início do quiz → conclusão etapa 1 → visualização do
      report → conclusão etapa 2 → agendamento) para saber onde há abandono
- [ ] Revisar os textos do report com marketing

---

## Decisões que valem revisitar com o time

**A projeção anual soma tarifa + tempo operacional.** O componente de tempo usa
`OPERATIONAL_HOURLY_COST_CENTS` (R$ 65/h) como custo carregado de quem reserva.
É a premissa mais discutível do cálculo — vale validar antes de expor a
prospects. O report deixa explícito que é estimativa e o rodapé mostra a
procedência dos números; isso é deliberado, porque um número que o prospect não
consegue defender internamente atrapalha a venda em vez de ajudar.

**Rotas sem amostra suficiente caem em fallback** com médias de trechos
equivalentes, e o report diz isso ao usuário. A alternativa — inventar número
para qualquer rota — cria um diagnóstico que não se sustenta na conversa com o
especialista.

**O quiz só oferece rotas que existem na fonte de benchmark.** O select é
alimentado pelo `GET /api/compass`, então nunca aparece uma opção para a qual
não há dado.

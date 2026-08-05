import type { MonthlySpendBand } from '@/lib/types';

/**
 * ATENÇÃO — mapeamento com uma lacuna real, leia antes de confiar nele.
 *
 * O quiz do Compass coleta gasto mensal em 6 faixas (lib/types.ts,
 * MONTHLY_SPEND_OPTIONS). O formulário 1 do joyride-flow espera um valor
 * de OUTRA enumeração, com 4 faixas (ver projeto.md, SPEND_MAP):
 *
 *   '1-3k' | '3-5k' | '5-9k' | 'Acima-10k'
 *
 * As 5 faixas mais altas do Compass ("De 10 a 30 mil" até "Mais de 1
 * milhão") mapeiam sem ambiguidade pra 'Acima-10k' — é literalmente
 * verdade, só perde granularidade que o joyride-flow nem usa acima de 10k.
 *
 * O PROBLEMA é a faixa mais baixa do Compass, "Até 10 mil reais/mês" —
 * ela cobre o MESMO intervalo que as três faixas mais finas do
 * joyride-flow (1-3k, 3-5k, 5-9k) juntas. O Compass não pergunta com essa
 * granularidade, então não tem como saber qual das três é a certa.
 *
 * E essa é justamente a faixa mais comum de chegar aqui: o relatório do
 * Compass SÓ mostra a opção de teste grátis sem alternativa quando o
 * gasto é "Até 10 mil reais/mês" (ver TRIAL_ONLY_SPEND em lib/types.ts) —
 * ou seja, boa parte de quem preenche esse formulário cai exatamente na
 * faixa que não dá pra mapear com precisão.
 *
 * Decisão tomada aqui (documentada, não escondida): usar '5-9k' como
 * valor do meio pra esse caso, em vez de chutar o extremo mais otimista
 * ('1-3k', que sub-representa) ou mais pessimista. Se isso influenciar o
 * workflow de aprovação do HubSpot de um jeito que importa, o certo é
 * adicionar a pergunta de faixa fina no formulário 1 deste fluxo (ele já
 * é um formulário à parte do quiz) em vez de confiar nesse chute.
 */
const DEFAULT_LOWEST_BAND_VALUE = '5-9k';

export type PlgSpendValue = '1-3k' | '3-5k' | '5-9k' | 'Acima-10k';

export function mapMonthlySpendToPlg(monthlySpend: MonthlySpendBand): PlgSpendValue {
  if (monthlySpend === 'Até 10 mil reais/mês') {
    return DEFAULT_LOWEST_BAND_VALUE;
  }
  return 'Acima-10k';
}

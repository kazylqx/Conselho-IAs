/**
 * ============================================================================
 *  CONFIANCA PROVISORIA
 * ============================================================================
 * A confianca definitiva vem do juiz na rodada 3. Mas a barra de confianca do
 * frontend precisa se mover ANTES disso, conforme o debate avanca. Estas funcoes
 * calculam uma estimativa heuristica e explicavel a cada etapa.
 *
 * Racional:
 *  - poucos agentes respondendo  -> menos confianca
 *  - todos mantendo a posicao    -> mais confianca (convergiram)
 *  - muitas discordancias vivas  -> menos confianca
 */

import { semDiscordancia } from './parsers.js';

/** Mantem o valor entre 0 e 100. */
const clamp = (valor) => Math.max(0, Math.min(100, Math.round(valor)));

/**
 * Estimativa no inicio do debate (nada respondido ainda).
 * @returns {{confidence: number, reason: string}}
 */
export function initialConfidence() {
  return { confidence: 10, reason: 'Debate iniciado, aguardando as primeiras respostas.' };
}

/**
 * Estimativa depois da rodada 1.
 * @param {object} params
 * @param {number} params.totalAgents   agentes convocados
 * @param {number} params.successAgents agentes que responderam
 */
export function confidenceAfterRound1({ totalAgents, successAgents }) {
  if (!successAgents) {
    return { confidence: 0, reason: 'Nenhum agente respondeu na rodada 1.' };
  }

  const taxaSucesso = successAgents / Math.max(1, totalAgents);
  const valor = clamp(35 + 25 * taxaSucesso);

  return {
    confidence: valor,
    reason: `${successAgents} de ${totalAgents} conselheiros responderam a rodada 1.`,
  };
}

/**
 * Estimativa depois da rodada 2, olhando posicao e discordancias de cada agente.
 * @param {object} params
 * @param {number} params.totalAgents
 * @param {Array<{structured?: {position: string|null, disagreements: string}}>} params.debateResults
 */
export function confidenceAfterRound2({ totalAgents, debateResults = [] }) {
  const respondentes = debateResults.length;
  if (!respondentes) {
    return {
      confidence: 25,
      reason: 'Nenhum conselheiro participou da rodada de debate.',
    };
  }

  const mantiveram = debateResults.filter((item) => item.structured?.position === 'MANTENHO').length;
  const comDiscordancia = debateResults.filter(
    (item) => item.structured?.disagreements && !semDiscordancia(item.structured.disagreements),
  ).length;

  const taxaManutencao = mantiveram / respondentes;
  const taxaDiscordancia = comDiscordancia / respondentes;
  const taxaSucesso = respondentes / Math.max(1, totalAgents);

  // 60% do peso na convergencia de posicao, 40% na ausencia de discordancia viva.
  const scoreConvergencia = 0.6 * taxaManutencao + 0.4 * (1 - taxaDiscordancia);

  // Participacao baixa nunca deixa a confianca subir muito.
  const valor = clamp((40 + 45 * scoreConvergencia) * (0.65 + 0.35 * taxaSucesso));

  const detalhes = [
    `${mantiveram}/${respondentes} mantiveram a posição`,
    comDiscordancia
      ? `${comDiscordancia} ainda apontam discordâncias`
      : 'nenhuma discordância aberta',
  ];

  return { confidence: valor, reason: `Debate analisado: ${detalhes.join(', ')}.` };
}

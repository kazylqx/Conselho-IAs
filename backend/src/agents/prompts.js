/**
 * ============================================================================
 *  PROMPTS DO DEBATE
 * ============================================================================
 * Todo texto enviado aos modelos fica centralizado aqui. Os prompts das rodadas
 * 2 e 3 pedem um formato de saida especifico porque o backend precisa extrair
 * dados estruturados deles (ver src/agents/parsers.js).
 */

import { debateSettings } from '../agents.config.js';

/** Corta um texto longo preservando o inicio e avisando que houve corte. */
function truncar(texto, limite) {
  if (!texto) return '';
  if (texto.length <= limite) return texto;
  return `${texto.slice(0, limite)}\n[...resposta truncada para caber no contexto...]`;
}

/**
 * Prompt de sistema de um agente do conselho (rodadas 1 e 2).
 * @param {object} agent entrada do agents.config.js
 */
export function buildAgentSystemPrompt(agent) {
  return [
    `Você é ${agent.name}, membro de um conselho de IAs que debate perguntas para chegar a uma resposta confiável.`,
    `Seu papel no conselho: ${agent.role}.`,
    agent.persona,
    '',
    'Regras do conselho:',
    `- Responda em ${debateSettings.language}.`,
    '- Seja direto e denso: sem introduções longas, sem repetir a pergunta.',
    '- Separe claramente o que é fato verificável, o que é inferência e o que é incerteza.',
    '- Se não souber, diga que não sabe. Inventar dado é a pior falha possível aqui.',
    '- Não finja ter acessado a internet: só use as fontes que forem entregues no prompt.',
    '- Mantenha sua personalidade, mas nunca à custa da honestidade intelectual.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Rodada 1 — resposta independente (o agente ainda nao viu ninguem).
 * @param {object} params
 * @param {string} params.question     pergunta do usuario
 * @param {string} [params.searchBlock] contexto de busca web ja formatado
 */
export function buildRound1Prompt({ question, searchBlock = '' }) {
  return [
    'PERGUNTA DO USUÁRIO:',
    question,
    '',
    searchBlock ? `${searchBlock}\n` : '',
    'TAREFA (Rodada 1 — resposta independente):',
    'Responda com sua melhor análise, sem saber o que os outros conselheiros vão dizer.',
    'Estruture assim:',
    '1. Resposta curta (2-4 frases).',
    '2. Raciocínio / evidências que sustentam a resposta.',
    '3. Incertezas: o que poderia mudar sua conclusão.',
    'Limite: no máximo ~350 palavras.',
  ]
    .filter((linha) => linha !== '')
    .join('\n');
}

/**
 * Rodada 2 — debate cruzado. O agente ve a propria resposta e a dos outros.
 * @param {object} params
 * @param {string} params.question
 * @param {string} params.myAnswer         resposta que ele mesmo deu na rodada 1
 * @param {Array<{name: string, role: string, answer: string}>} params.peers
 */
export function buildRound2Prompt({ question, myAnswer, peers }) {
  const limite = debateSettings.maxPeerAnswerChars;

  const blocosDosOutros = peers
    .map(
      (peer, index) =>
        `--- CONSELHEIRO ${index + 1}: ${peer.name} (${peer.role}) ---\n${truncar(peer.answer, limite)}`,
    )
    .join('\n\n');

  return [
    'PERGUNTA ORIGINAL:',
    question,
    '',
    'SUA RESPOSTA NA RODADA 1:',
    truncar(myAnswer, limite),
    '',
    'RESPOSTAS DOS OUTROS CONSELHEIROS:',
    blocosDosOutros || '(nenhum outro conselheiro respondeu)',
    '',
    'TAREFA (Rodada 2 — debate):',
    'Analise criticamente as respostas acima e responda EXATAMENTE neste formato,',
    'usando os quatro rótulos em maiúsculas, cada um começando em uma nova linha:',
    '',
    'CONCORDÂNCIAS: pontos em que você concorda com quais conselheiros e por quê.',
    'DISCORDÂNCIAS: onde você discorda, de quem, e qual evidência faltou ou qual erro existe. Se não houver, escreva "nenhuma".',
    'POSIÇÃO: escreva apenas MANTENHO ou REVISO (uma palavra).',
    'RESPOSTA ATUALIZADA: sua resposta final desta rodada, já incorporando o que você aceitou dos outros.',
    '',
    'Seja específico: cite o nome do conselheiro ao concordar ou discordar.',
    'Limite: no máximo ~400 palavras no total.',
  ].join('\n');
}

/** Prompt de sistema do juiz (rodada 3). */
export function buildJudgeSystemPrompt(judge) {
  return [
    `Você é ${judge.name}, a juíza de um conselho de IAs.`,
    judge.persona,
    '',
    'Regras:',
    `- Escreva em ${debateSettings.language}.`,
    '- Você não introduz informação nova: só consolida o que o debate produziu.',
    '- Se o conselho não resolveu algo, isso vira ponto de discordância, não é escondido.',
    '- A confiança deve refletir a realidade do debate: consenso amplo com evidência = alta;',
    '  discordância forte, poucos agentes ou dado ausente = baixa.',
    '- Responda SOMENTE com o objeto JSON pedido, sem texto antes ou depois, sem cercas de código.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Rodada 3 — veredito. Recebe a transcricao completa do debate.
 * @param {object} params
 * @param {string} params.question
 * @param {string} params.transcript      transcricao formatada das rodadas 1 e 2
 * @param {number} params.totalAgents     quantos agentes foram convocados
 * @param {number} params.respondingAgents quantos realmente responderam
 * @param {string[]} [params.failures]    descricao das falhas de agentes
 */
export function buildJudgePrompt({
  question,
  transcript,
  totalAgents,
  respondingAgents,
  failures = [],
}) {
  return [
    'PERGUNTA ORIGINAL DO USUÁRIO:',
    question,
    '',
    'TRANSCRIÇÃO COMPLETA DO DEBATE:',
    transcript,
    '',
    'METADADOS DO DEBATE:',
    `- Conselheiros convocados: ${totalAgents}`,
    `- Conselheiros que responderam: ${respondingAgents}`,
    failures.length ? `- Falhas registradas: ${failures.join('; ')}` : '- Falhas registradas: nenhuma',
    '',
    'TAREFA (Rodada 3 — VEREDITO):',
    'Leia todo o debate e produza o veredito final consolidado.',
    'Responda APENAS com um JSON válido neste formato exato:',
    '{',
    '  "resposta_final": "resposta consolidada, autossuficiente, em 1 a 4 parágrafos",',
    '  "confianca": 0,',
    '  "pontos_de_consenso": ["ponto em que os conselheiros convergiram", "..."],',
    '  "pontos_de_discordancia": ["divergência que ficou sem resolução", "..."],',
    '  "ressalvas": "o que o usuário deveria verificar por conta própria (string, pode ser vazia)"',
    '}',
    '',
    'Regras do JSON:',
    '- "confianca" é um número inteiro de 0 a 100.',
    '- Se não houver discordâncias, use uma lista vazia [].',
    '- Não use markdown, não use cercas de código, não escreva nada fora do JSON.',
  ].join('\n');
}

/**
 * Monta a transcricao do debate no formato que o juiz recebe.
 * @param {object} params
 * @param {Array} params.round1 [{ agent, text }]
 * @param {Array} params.round2 [{ agent, text }]
 */
export function buildTranscript({ round1 = [], round2 = [] }) {
  const partes = [];

  partes.push('===== RODADA 1 — RESPOSTAS INDEPENDENTES =====');
  if (!round1.length) {
    partes.push('(nenhuma resposta)');
  } else {
    for (const item of round1) {
      partes.push(`\n### ${item.agent.name} (${item.agent.role})\n${item.text}`);
    }
  }

  if (round2.length) {
    partes.push('\n===== RODADA 2 — DEBATE CRUZADO =====');
    for (const item of round2) {
      partes.push(`\n### ${item.agent.name} (${item.agent.role})\n${item.text}`);
    }
  }

  return partes.join('\n');
}

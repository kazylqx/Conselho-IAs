/**
 * ============================================================================
 *  ORQUESTRADOR DO DEBATE
 * ============================================================================
 * Coordena as tres rodadas e emite um evento por etapa. Regra de ouro:
 * o debate NUNCA para por causa de um agente. Se um falha (timeout, chave
 * errada, erro da API), o evento `agent_error` eh emitido e os outros seguem.
 *
 * Sequencia de eventos emitidos:
 *   debate_started -> round_started(1) -> [agent_typing, agent_response|agent_error]*
 *   -> confidence_update -> round_started(2) -> [agent_typing, agent_debate|agent_error]*
 *   -> confidence_update -> round_started(3) -> agent_typing -> final_verdict
 *   -> debate_completed
 */

import {
  getActiveAgents,
  judge as judgeConfig,
  debateSettings,
  toPublicAgent,
} from '../agents.config.js';
import { callModel, isMockMode } from './providers.js';
import { webSearch, needsFreshData, formatSearchResultsForPrompt } from './webSearch.js';
import {
  buildAgentSystemPrompt,
  buildRound1Prompt,
  buildRound2Prompt,
  buildJudgeSystemPrompt,
  buildJudgePrompt,
  buildTranscript,
} from './prompts.js';
import { parseDebateResponse, parseJudgeVerdict, buildFallbackVerdict } from './parsers.js';
import {
  initialConfidence,
  confidenceAfterRound1,
  confidenceAfterRound2,
} from './confidence.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mensagem amigavel para o usuario a partir de um erro de provedor. */
function descreverFalha(error) {
  const codigo = error?.code ?? 'erro';
  const mapa = {
    timeout: 'não respondeu no tempo limite',
    missing_api_key: 'está sem chave de API configurada',
    missing_base_url: 'está sem base URL configurada',
    network_error: 'falhou por erro de rede',
    temporarily_unavailable: 'está temporariamente indisponível (limite ou instabilidade da API)',
    empty_response: 'devolveu uma resposta vazia',
    unknown_provider: 'usa um provedor não suportado',
    api_error: 'foi rejeitado pela API',
  };
  return mapa[codigo] ?? 'falhou';
}

/**
 * Executa o debate completo.
 *
 * @param {object} params
 * @param {string} params.debateId
 * @param {string} params.question
 * @param {(type: string, payload: object) => Promise<void>|void} params.emit
 *        funcao que persiste + transmite o evento (ver src/sockets/index.js)
 * @returns {Promise<{verdict: object, confidence: number, failures: string[]}>}
 */
export async function runDebate({ debateId, question, emit }) {
  const iniciouEm = Date.now();
  const agentesAtivos = getActiveAgents();
  const falhas = [];

  if (!agentesAtivos.length) {
    throw new Error('Nenhum agente habilitado em agents.config.js');
  }

  await emit('debate_started', {
    debateId,
    question,
    agents: agentesAtivos.map(toPublicAgent),
    judge: toPublicAgent(judgeConfig),
    mock: isMockMode(),
  });

  await emit('confidence_update', initialConfidence());

  // -------------------------------------------------------------------------
  // Busca na web (contrato abstrato). Cache por consulta para nao repetir a
  // mesma chamada quando varios agentes pedirem o mesmo texto.
  // -------------------------------------------------------------------------
  const precisaDadosAtuais = needsFreshData(question);
  const cacheBusca = new Map();

  async function buscarContexto(agent) {
    if (!precisaDadosAtuais || !agent.canUseWebSearch) return { block: '', used: false };

    const consulta = question;
    if (!cacheBusca.has(consulta)) {
      cacheBusca.set(consulta, webSearch(consulta, { maxResults: 5, language: 'pt-BR' }));
    }

    try {
      const resultado = await cacheBusca.get(consulta);
      const block = formatSearchResultsForPrompt(resultado);
      return { block, used: Boolean(block) };
    } catch (error) {
      // Busca quebrada nunca derruba o debate.
      return { block: '', used: false, error: error.message };
    }
  }

  if (precisaDadosAtuais) {
    const amostra = await buscarContexto(
      agentesAtivos.find((a) => a.canUseWebSearch) ?? agentesAtivos[0],
    );
    await emit('search_note', {
      needed: true,
      available: amostra.used,
      message: amostra.used
        ? 'Os conselheiros receberam resultados de busca na web.'
        : 'A pergunta parece depender de dados atuais, mas a busca na web ainda não está ' +
          'implementada (webSearch). Os conselheiros vão responder só com conhecimento próprio.',
    });
  }

  // =========================================================================
  // RODADA 1 — respostas independentes
  // =========================================================================
  await emit('round_started', { round: 1, label: debateSettings.rounds[1].label });

  const respostasRodada1 = [];

  await Promise.all(
    agentesAtivos.map(async (agent, indice) => {
      // Escalonamento: faz os "digitando..." aparecerem em sequencia.
      await sleep(indice * debateSettings.staggerMs);
      await emit('agent_typing', { agentId: agent.id, round: 1 });

      try {
        const contexto = await buscarContexto(agent);
        const resposta = await callModel({
          config: agent,
          system: buildAgentSystemPrompt(agent),
          prompt: buildRound1Prompt({ question, searchBlock: contexto.block }),
        });

        respostasRodada1.push({ agent, text: resposta.text, ordem: indice });

        await emit('agent_response', {
          agentId: agent.id,
          round: 1,
          content: resposta.text,
          provider: resposta.provider,
          model: resposta.model,
          durationMs: resposta.durationMs,
          usedWebSearch: contexto.used,
          mocked: resposta.mocked,
        });
      } catch (error) {
        const descricao = `${agent.name} ${descreverFalha(error)}`;
        falhas.push(descricao);
        await emit('agent_error', {
          agentId: agent.id,
          round: 1,
          code: error?.code ?? 'error',
          message: descricao,
          detail: error?.message ?? String(error),
        });
      }
    }),
  );

  // Mantem a ordem do agents.config.js (Promise.all resolve fora de ordem).
  respostasRodada1.sort((a, b) => a.ordem - b.ordem);

  const conf1 = confidenceAfterRound1({
    totalAgents: agentesAtivos.length,
    successAgents: respostasRodada1.length,
  });
  await emit('confidence_update', conf1);

  if (respostasRodada1.length < debateSettings.minAgentsToContinue) {
    throw new Error(
      'Nenhum conselheiro conseguiu responder. Verifique as chaves de API no .env ' +
        '(ou ative MOCK_AI=true para testar sem chaves).',
    );
  }

  // =========================================================================
  // RODADA 2 — debate cruzado
  // =========================================================================
  const debateHabilitado = debateSettings.enableDebateRound && respostasRodada1.length >= 2;
  const respostasRodada2 = [];

  if (debateHabilitado) {
    await emit('round_started', { round: 2, label: debateSettings.rounds[2].label });

    await Promise.all(
      respostasRodada1.map(async (item, indice) => {
        const { agent } = item;
        await sleep(indice * debateSettings.staggerMs);
        await emit('agent_typing', { agentId: agent.id, round: 2 });

        const peers = respostasRodada1
          .filter((outro) => outro.agent.id !== agent.id)
          .map((outro) => ({
            name: outro.agent.name,
            role: outro.agent.role,
            answer: outro.text,
          }));

        try {
          const resposta = await callModel({
            config: agent,
            system: buildAgentSystemPrompt(agent),
            prompt: buildRound2Prompt({ question, myAnswer: item.text, peers }),
          });

          const estruturado = parseDebateResponse(resposta.text);
          respostasRodada2.push({
            agent,
            text: resposta.text,
            structured: estruturado,
            ordem: indice,
          });

          await emit('agent_debate', {
            agentId: agent.id,
            round: 2,
            content: resposta.text,
            structured: estruturado,
            provider: resposta.provider,
            model: resposta.model,
            durationMs: resposta.durationMs,
            mocked: resposta.mocked,
          });
        } catch (error) {
          const descricao = `${agent.name} ${descreverFalha(error)} na rodada de debate`;
          falhas.push(descricao);
          await emit('agent_error', {
            agentId: agent.id,
            round: 2,
            code: error?.code ?? 'error',
            message: descricao,
            detail: error?.message ?? String(error),
          });
        }
      }),
    );

    respostasRodada2.sort((a, b) => a.ordem - b.ordem);

    const conf2 = confidenceAfterRound2({
      totalAgents: agentesAtivos.length,
      debateResults: respostasRodada2,
    });
    await emit('confidence_update', conf2);
  } else if (debateSettings.enableDebateRound) {
    await emit('search_note', {
      needed: false,
      available: false,
      message:
        'Rodada de debate pulada: é preciso pelo menos dois conselheiros respondendo ' +
        'para haver contraditório.',
    });
  }

  // =========================================================================
  // RODADA 3 — veredito do juiz
  // =========================================================================
  await emit('round_started', { round: 3, label: debateSettings.rounds[3].label });
  await emit('agent_typing', { agentId: judgeConfig.id, round: 3 });

  // Resposta mais atual de cada agente: a revisada na rodada 2, senao a da rodada 1.
  const respostasFinais = respostasRodada1.map((item) => {
    const noDebate = respostasRodada2.find((outro) => outro.agent.id === item.agent.id);
    return {
      agent: item.agent,
      text: noDebate?.structured?.updatedAnswer || item.text,
      structured: noDebate?.structured,
    };
  });

  const confianciaHeuristica = respostasRodada2.length
    ? confidenceAfterRound2({ totalAgents: agentesAtivos.length, debateResults: respostasRodada2 })
        .confidence
    : conf1.confidence;

  let veredito;

  try {
    const resposta = await callModel({
      config: judgeConfig,
      system: buildJudgeSystemPrompt(judgeConfig),
      prompt: buildJudgePrompt({
        question,
        transcript: buildTranscript({ round1: respostasRodada1, round2: respostasRodada2 }),
        totalAgents: agentesAtivos.length,
        respondingAgents: respostasRodada1.length,
        failures: falhas,
      }),
    });

    veredito = {
      ...parseJudgeVerdict(resposta.text),
      generatedBy: toPublicAgent(judgeConfig),
      provider: resposta.provider,
      model: resposta.model,
      durationMs: resposta.durationMs,
      mocked: resposta.mocked,
    };
  } catch (error) {
    const descricao = `${judgeConfig.name} ${descreverFalha(error)}`;
    falhas.push(descricao);

    await emit('agent_error', {
      agentId: judgeConfig.id,
      round: 3,
      code: error?.code ?? 'error',
      message: descricao,
      detail: error?.message ?? String(error),
    });

    veredito = {
      ...buildFallbackVerdict({
        finalAnswers: respostasFinais,
        confidence: confianciaHeuristica,
        reason: descreverFalha(error),
      }),
      generatedBy: { id: 'backend', name: 'Backend (fallback)', role: 'Sistema', avatar: '🛟', color: '#94a3b8' },
    };
  }

  // Metadados uteis para a UI e para o historico.
  veredito.participatingAgents = respostasRodada1.map((item) => item.agent.id);
  veredito.failedAgents = agentesAtivos
    .filter((agent) => !respostasRodada1.some((item) => item.agent.id === agent.id))
    .map((agent) => agent.id);
  veredito.failures = falhas;

  await emit('final_verdict', { verdict: veredito });

  await emit('confidence_update', {
    confidence: veredito.confidence,
    reason: veredito.fallback
      ? 'Confiança estimada pelo backend (o juiz falhou).'
      : 'Confiança final definida pelo juiz.',
    final: true,
  });

  await emit('debate_completed', {
    debateId,
    confidence: veredito.confidence,
    durationMs: Date.now() - iniciouEm,
    failures: falhas,
  });

  return { verdict: veredito, confidence: veredito.confidence, failures: falhas };
}

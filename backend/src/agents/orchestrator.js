/**
 * ============================================================================
 *  ORQUESTRADOR DO DEBATE
 * ============================================================================
 * Coordena as tres rodadas e emite um evento por etapa. Regra de ouro:
 * o debate NUNCA para por causa de um agente. Se um falha (timeout, chave
 * errada, erro da API), o evento `agent_error` eh emitido e os outros seguem.
 * O mesmo vale para a busca na web: se ela cair, o debate continua sem fontes.
 *
 * Busca na web (Tavily) entra em dois momentos:
 *   Rodada 1 — uma busca compartilhada, quando a pergunta parece depender de
 *              dado atual (needsFreshData). Todos os agentes com
 *              canUseWebSearch recebem as MESMAS fontes.
 *   Rodada 2 — cada agente pode pedir UMA verificacao propria escrevendo
 *              "BUSCAR: <consulta>". Isso eh o que permite checar o que o
 *              outro conselheiro afirmou com dado novo.
 * Todas as fontes entram em um registro numerado do debate, e os numeros ([1],
 * [2]...) sao os mesmos para agentes, juiz e interface.
 *
 * Sequencia de eventos emitidos:
 *   debate_started -> [search_note] -> round_started(1) -> [web_search]
 *   -> [agent_typing, agent_response|agent_error]* -> confidence_update
 *   -> round_started(2) -> [agent_typing, web_search?, agent_debate|agent_error]*
 *   -> confidence_update -> round_started(3) -> agent_typing -> final_verdict
 *   -> confidence_update -> debate_completed
 */

import {
  getActiveAgents,
  judge as judgeConfig,
  debateSettings,
  toPublicAgent,
} from '../agents.config.js';
import { callModel, isMockMode } from './providers.js';
import {
  webSearch,
  needsFreshData,
  formatSourcesForPrompt,
  isWebSearchAvailable,
} from './webSearch.js';
import {
  buildAgentSystemPrompt,
  buildRound1Prompt,
  buildRound2Prompt,
  buildJudgeSystemPrompt,
  buildJudgePrompt,
  buildTranscript,
} from './prompts.js';
import {
  parseDebateResponse,
  parseJudgeVerdict,
  buildFallbackVerdict,
  extractSearchRequest,
} from './parsers.js';
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

/** Versao enxuta da fonte para guardar no veredito e mandar para a UI. */
function fonteParaUI(fonte) {
  return {
    n: fonte.n,
    title: fonte.title,
    url: fonte.url,
    source: fonte.source,
    publishedAt: fonte.publishedAt ?? null,
  };
}

/**
 * Resolve as referencias citadas pelo juiz (numeros ou URLs) nas fontes reais.
 * Ignora numero inventado — o juiz nao consegue "criar" fonte.
 */
function resolverFontesCitadas(refs = [], disponiveis = []) {
  const porNumero = new Map(disponiveis.map((fonte) => [fonte.n, fonte]));
  const porUrl = new Map(disponiveis.map((fonte) => [fonte.url, fonte]));
  const escolhidas = [];

  for (const ref of refs) {
    let achada = null;

    if (typeof ref === 'number') {
      achada = porNumero.get(ref) ?? null;
    } else {
      const texto = String(ref);
      achada =
        porUrl.get(texto) ??
        disponiveis.find((fonte) => texto.includes(fonte.url) || fonte.url.includes(texto)) ??
        null;
    }

    if (achada && !escolhidas.includes(achada)) escolhidas.push(achada);
  }

  return escolhidas;
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

  // =========================================================================
  // BUSCA NA WEB — registro de fontes, cache e orcamento de creditos
  // =========================================================================
  const configBusca = debateSettings.search ?? {};
  const buscaConfigurada = isWebSearchAvailable();

  /** Quantas chamadas de busca ainda podem ser feitas neste debate. */
  let orcamentoBuscas = buscaConfigurada ? (configBusca.maxPerDebate ?? 6) : 0;

  /** url -> { n, title, url, snippet, publishedAt, source } */
  const registroFontes = new Map();

  /** consulta normalizada -> Promise<WebSearchResponse> (evita gastar 2x o mesmo crédito) */
  const cacheBuscas = new Map();

  /** Numera e guarda as fontes novas; devolve as entradas desta busca. */
  function registrarFontes(resultados = []) {
    const entradas = [];
    for (const resultado of resultados) {
      if (!resultado.url) continue;
      if (!registroFontes.has(resultado.url)) {
        registroFontes.set(resultado.url, { n: registroFontes.size + 1, ...resultado });
      }
      const entrada = registroFontes.get(resultado.url);
      if (!entradas.includes(entrada)) entradas.push(entrada);
    }
    return entradas;
  }

  const todasAsFontes = () => [...registroFontes.values()];

  /**
   * Faz uma busca (respeitando cache e orcamento) e avisa a interface.
   * Nunca lanca: webSearch() ja devolve o erro no proprio retorno.
   */
  async function executarBusca({ query, agentId = null, round, shared = false, titulo }) {
    if (!buscaConfigurada) {
      return { block: '', entries: [], available: false, response: null };
    }

    const chave = query.trim().toLowerCase();
    let promessa = cacheBuscas.get(chave);
    const veioDoCache = Boolean(promessa);

    if (!promessa) {
      if (orcamentoBuscas <= 0) {
        await emit('search_note', {
          needed: true,
          available: false,
          message: `Limite de ${configBusca.maxPerDebate ?? 6} buscas por debate atingido: a verificação foi ignorada.`,
        });
        return { block: '', entries: [], available: false, response: null, budgetExhausted: true };
      }

      orcamentoBuscas -= 1;
      promessa = webSearch(query, {
        maxResults: configBusca.maxResults ?? 5,
        searchDepth: configBusca.depth ?? 'basic',
        // Agrupa as buscas deste debate nos logs da Tavily.
        sessionId: debateId,
      });
      cacheBuscas.set(chave, promessa);
    }

    const response = await promessa;
    const entries = response.implemented ? registrarFontes(response.results) : [];
    const block = formatSourcesForPrompt(entries, {
      titulo: titulo ?? 'FONTES DA WEB',
    });

    await emit('web_search', {
      agentId,
      round,
      shared,
      query,
      provider: response.provider,
      available: response.implemented,
      cached: veioDoCache,
      resultCount: entries.length,
      results: entries.map(fonteParaUI),
      note: response.note ?? null,
    });

    return { block, entries, available: response.implemented, response };
  }

  // -------------------------------------------------------------------------
  // Busca compartilhada da rodada 1 (uma só, quando a pergunta pede dado atual)
  // -------------------------------------------------------------------------
  const precisaDadosAtuais = needsFreshData(question);
  let contextoCompartilhado = { block: '', available: false };

  if (precisaDadosAtuais) {
    if (buscaConfigurada) {
      contextoCompartilhado = await executarBusca({
        query: question,
        round: 1,
        shared: true,
        titulo: 'FONTES DA WEB (busca feita para esta pergunta)',
      });

      await emit('search_note', {
        needed: true,
        available: contextoCompartilhado.available,
        message: contextoCompartilhado.entries?.length
          ? `Os conselheiros receberam ${contextoCompartilhado.entries.length} fonte(s) da web para esta pergunta.`
          : contextoCompartilhado.response?.note ||
            'A busca na web não trouxe resultados: os conselheiros vão responder com conhecimento próprio.',
      });
    } else {
      await emit('search_note', {
        needed: true,
        available: false,
        message:
          'A pergunta parece depender de dados atuais, mas a busca na web está desligada ' +
          '(defina WEB_SEARCH_API_KEY no backend). Os conselheiros vão responder só com ' +
          'conhecimento próprio.',
      });
    }
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

      const usouBusca = agent.canUseWebSearch !== false && Boolean(contextoCompartilhado.block);

      try {
        const resposta = await callModel({
          config: agent,
          system: buildAgentSystemPrompt(agent),
          prompt: buildRound1Prompt({
            question,
            searchBlock: usouBusca ? contextoCompartilhado.block : '',
          }),
        });

        respostasRodada1.push({ agent, text: resposta.text, ordem: indice });

        await emit('agent_response', {
          agentId: agent.id,
          round: 1,
          content: resposta.text,
          provider: resposta.provider,
          model: resposta.model,
          durationMs: resposta.durationMs,
          usedWebSearch: usouBusca,
          // Sinaliza quando o modelo primário estava indisponível e uma reserva
          // assumiu — a interface mostra isso na fala.
          usedFallback: resposta.usedFallback,
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
  // RODADA 2 — debate cruzado (com direito a uma verificacao na web por agente)
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

        // Fontes já coletadas (rodada 1 + buscas de outros agentes que já rodaram).
        // Na rodada 2 o prompt já carrega a pergunta, a própria resposta e a dos
        // colegas: cortamos as fontes para não estourar o limite de tokens por
        // minuto das camadas gratuitas (a Groq libera 8k TPM).
        const blocoFontes = formatSourcesForPrompt(todasAsFontes(), {
          titulo: 'FONTES DA WEB JÁ COLETADAS NESTE DEBATE',
          limit: configBusca.maxSourcesInDebateRound ?? 4,
          maxSnippet: 260,
        });

        const podePedirBusca =
          buscaConfigurada &&
          configBusca.inDebateRound !== false &&
          agent.canUseWebSearch !== false &&
          orcamentoBuscas > 0;

        try {
          let resposta = await callModel({
            config: agent,
            system: buildAgentSystemPrompt(agent),
            prompt: buildRound2Prompt({
              question,
              myAnswer: item.text,
              peers,
              searchBlock: blocoFontes,
              allowSearchRequest: podePedirBusca,
            }),
          });

          // O agente pediu verificacao? Busca e pergunta de novo (uma vez só).
          const pedido = podePedirBusca
            ? extractSearchRequest(resposta.text)
            : { query: null, cleaned: resposta.text };

          let buscouNaRodada = false;

          if (pedido.query) {
            const busca = await executarBusca({
              query: pedido.query,
              agentId: agent.id,
              round: 2,
              titulo: 'RESULTADO DA SUA VERIFICAÇÃO',
            });
            buscouNaRodada = busca.available;

            await emit('agent_typing', { agentId: agent.id, round: 2 });

            resposta = await callModel({
              config: agent,
              system: buildAgentSystemPrompt(agent),
              prompt: buildRound2Prompt({
                question,
                myAnswer: item.text,
                peers,
                searchBlock: blocoFontes,
                searchRequest: {
                  query: pedido.query,
                  block: busca.block,
                  note: busca.response?.note,
                },
              }),
            });
          }

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
            usedWebSearch: buscouNaRodada,
            searchQuery: pedido.query ?? null,
            usedFallback: resposta.usedFallback,
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

  const fontesDisponiveis = todasAsFontes();
  let veredito;

  try {
    const resposta = await callModel({
      config: judgeConfig,
      /**
       * O veredito precisa ser JSON: se vier texto solto (modelo de raciocínio
       * despejando o rascunho, por exemplo), isso conta como falha e a cadeia
       * tenta de novo / passa para a reserva — muito melhor que exibir o
       * rascunho mental do modelo como resposta final.
       */
      validate: (texto) => {
        const interpretado = parseJudgeVerdict(texto);
        if (!interpretado.parsed) return 'o veredito não veio como JSON válido';
        if (!interpretado.finalAnswer || interpretado.finalAnswer.length < 40) {
          return 'o veredito veio sem resposta final utilizável';
        }
        return null;
      },
      system: buildJudgeSystemPrompt(judgeConfig),
      prompt: buildJudgePrompt({
        question,
        transcript: buildTranscript({ round1: respostasRodada1, round2: respostasRodada2 }),
        totalAgents: agentesAtivos.length,
        respondingAgents: respostasRodada1.length,
        failures: falhas,
        sourcesBlock: formatSourcesForPrompt(fontesDisponiveis, {
          titulo: 'FONTES DA WEB CONSULTADAS DURANTE O DEBATE',
        }),
      }),
    });

    const interpretado = parseJudgeVerdict(resposta.text);

    // Só entram fontes que existem de verdade no registro do debate.
    const citadas = resolverFontesCitadas(interpretado.sourceRefs, fontesDisponiveis);

    veredito = {
      ...interpretado,
      // Se o juiz não citou nada mas houve busca, mostramos o que foi consultado.
      sources: (citadas.length ? citadas : fontesDisponiveis.slice(0, 6)).map(fonteParaUI),
      sourcesFromRegistry: citadas.length === 0 && fontesDisponiveis.length > 0,
      generatedBy: toPublicAgent(judgeConfig),
      provider: resposta.provider,
      model: resposta.model,
      durationMs: resposta.durationMs,
      usedFallback: resposta.usedFallback,
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
        sources: fontesDisponiveis.map(fonteParaUI),
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
  veredito.searchesPerformed = cacheBuscas.size;

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
    searchesPerformed: cacheBuscas.size,
    sourcesFound: registroFontes.size,
  });

  return { verdict: veredito, confidence: veredito.confidence, failures: falhas };
}

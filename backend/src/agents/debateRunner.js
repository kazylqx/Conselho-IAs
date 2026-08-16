/**
 * ============================================================================
 *  DISPARO DO DEBATE
 * ============================================================================
 * Liga as pecas: cria o registro no banco, devolve o id imediatamente para o
 * frontend (a rota REST nao espera o debate acabar) e roda a orquestracao em
 * segundo plano transmitindo tudo por WebSocket.
 */

import { getActiveAgents, judge as judgeConfig, toPublicAgent } from '../agents.config.js';
import { createEmitter } from '../sockets/index.js';
import { isMockMode } from './providers.js';
import { runDebate } from './orchestrator.js';
import { tooManyRequests } from '../utils/httpError.js';

/** Ids dos debates rodando agora (limita consumo de API e memoria). */
const emAndamento = new Set();

/** Pequeno atraso antes de comecar, para o cliente entrar na sala do socket. */
const ATRASO_INICIAL_MS = 300;

/** Quantos debates estao rodando neste momento. */
export function contarDebatesEmAndamento() {
  return emAndamento.size;
}

/**
 * Cria e dispara um debate.
 *
 * @param {object} params
 * @param {string} params.question
 * @param {import('socket.io').Server} params.io
 * @param {object} params.db
 * @returns {Promise<object>} registro do debate recem-criado
 */
export async function startDebate({ question, io, db }) {
  const limite = Number.parseInt(process.env.MAX_CONCURRENT_DEBATES ?? '3', 10) || 3;
  if (emAndamento.size >= limite) {
    throw tooManyRequests(
      `Já existem ${emAndamento.size} debates em andamento. Aguarde um terminar.`,
      'debate_limit_reached',
    );
  }

  const agentesPublicos = getActiveAgents().map(toPublicAgent);
  const debate = await db.createDebate({
    question,
    agents: agentesPublicos,
    judge: toPublicAgent(judgeConfig),
    mock: isMockMode(),
  });

  emAndamento.add(debate.id);

  // Fire-and-forget: o cliente acompanha pelo WebSocket.
  setTimeout(() => {
    executarEmSegundoPlano({ debate, io, db }).catch((error) => {
      console.error(`[debate ${debate.id}] erro não tratado:`, error);
    });
  }, ATRASO_INICIAL_MS);

  return debate;
}

/** Executa a orquestracao e cuida do estado final no banco. */
async function executarEmSegundoPlano({ debate, io, db }) {
  const emit = createEmitter({ io, db, debateId: debate.id });
  const inicio = Date.now();

  console.log(`[debate ${debate.id}] iniciado: "${debate.question.slice(0, 80)}"`);

  try {
    const resultado = await runDebate({
      debateId: debate.id,
      question: debate.question,
      emit,
    });

    await db.updateDebate(debate.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      verdict: resultado.verdict,
      confidence: resultado.confidence,
      error: null,
    });

    console.log(
      `[debate ${debate.id}] concluído em ${Math.round((Date.now() - inicio) / 1000)}s ` +
        `(confiança ${resultado.confidence}%)`,
    );
  } catch (error) {
    console.error(`[debate ${debate.id}] falhou:`, error.message);

    await db.updateDebate(debate.id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: error.message,
    });

    // Avisa o frontend para ele sair do estado de "carregando".
    await emit('debate_error', {
      message: error.message,
      code: error.code ?? 'debate_failed',
    });
  } finally {
    emAndamento.delete(debate.id);
  }
}

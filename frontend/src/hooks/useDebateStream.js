/**
 * ============================================================================
 *  useDebateStream — estado do debate em tempo real
 * ============================================================================
 * Junta duas fontes na mesma linha do tempo:
 *   1. REST  (GET /api/debate/:id) -> tudo que ja aconteceu, mesmo em debate antigo
 *   2. Socket (debate_snapshot + eventos ao vivo) -> o que acontece a partir de agora
 *
 * Os eventos persistidos tem `seq`, o que permite ignorar duplicatas quando o
 * snapshot e os eventos ao vivo se sobrepoem (recarregar a pagina no meio do
 * debate, por exemplo).
 */

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { api } from '../services/api.js';
import { getSocket, joinDebate, subscribe } from '../services/socket.js';

/** Eventos que escutamos no socket. */
const EVENTOS_SOCKET = [
  'debate_snapshot',
  'debate_not_found',
  'debate_started',
  'round_started',
  'search_note',
  'web_search',
  'agent_typing',
  'agent_response',
  'agent_debate',
  'agent_error',
  'confidence_update',
  'final_verdict',
  'debate_completed',
  'debate_error',
];

const estadoInicial = {
  loading: true,
  notFound: false,
  error: null,
  connected: false,
  debate: null,
  agentsById: {},
  timeline: [],
  typing: {},
  confidence: { value: 0, reason: '', final: false },
  verdict: null,
  status: 'running',
  seen: {},
};

/** Indexa agentes (e o juiz) por id para a UI achar cor/nome/avatar. */
function indexarAgentes(agents = [], judge = null) {
  const mapa = {};
  for (const agent of agents) mapa[agent.id] = agent;
  if (judge) mapa[judge.id] = judge;
  return mapa;
}

/**
 * Aplica um evento ao estado. Funcao pura: sempre devolve um estado novo.
 * @param {object} estado
 * @param {string} type
 * @param {object} payload
 */
function aplicarEvento(estado, type, payload) {
  // Dedupe de eventos persistidos.
  if (payload?.seq != null && estado.seen[payload.seq]) return estado;

  const seen = payload?.seq != null ? { ...estado.seen, [payload.seq]: true } : estado.seen;
  const base = { ...estado, seen, loading: false };
  const chave = `${type}-${payload?.seq ?? payload?.at ?? Math.random()}`;

  switch (type) {
    case 'debate_started':
      return {
        ...base,
        agentsById: indexarAgentes(payload.agents, payload.judge),
        debate: {
          ...(base.debate ?? {}),
          id: payload.debateId,
          question: payload.question ?? base.debate?.question,
          agents: payload.agents,
          judge: payload.judge,
          mock: payload.mock,
        },
      };

    case 'round_started':
      return {
        ...base,
        timeline: [
          ...base.timeline,
          { kind: 'round', key: chave, round: payload.round, label: payload.label },
        ],
      };

    case 'search_note':
      return {
        ...base,
        timeline: [
          ...base.timeline,
          { kind: 'system', key: chave, message: payload.message, at: payload.at },
        ],
      };

    case 'web_search':
      return {
        ...base,
        timeline: [
          ...base.timeline,
          {
            kind: 'search',
            key: chave,
            agentId: payload.agentId ?? null,
            round: payload.round,
            shared: Boolean(payload.shared),
            cached: Boolean(payload.cached),
            available: Boolean(payload.available),
            query: payload.query,
            results: payload.results ?? [],
            note: payload.note ?? null,
            at: payload.at,
          },
        ],
      };

    case 'agent_typing': {
      // Nao mostra "digitando" depois do debate encerrado.
      if (base.status !== 'running') return base;
      return { ...base, typing: { ...base.typing, [payload.agentId]: payload.round } };
    }

    case 'agent_response':
    case 'agent_debate': {
      const { [payload.agentId]: _removido, ...typing } = base.typing;
      return {
        ...base,
        typing,
        timeline: [
          ...base.timeline,
          {
            kind: 'message',
            key: chave,
            variant: type === 'agent_debate' ? 'debate' : 'response',
            agentId: payload.agentId,
            round: payload.round,
            content: payload.content,
            structured: payload.structured ?? null,
            at: payload.at,
            meta: {
              provider: payload.provider,
              model: payload.model,
              durationMs: payload.durationMs,
              usedWebSearch: payload.usedWebSearch,
              mocked: payload.mocked,
            },
          },
        ],
      };
    }

    case 'agent_error': {
      const { [payload.agentId]: _removido, ...typing } = base.typing;
      return {
        ...base,
        typing,
        timeline: [
          ...base.timeline,
          {
            kind: 'error',
            key: chave,
            agentId: payload.agentId,
            round: payload.round,
            message: payload.message,
            detail: payload.detail,
            at: payload.at,
          },
        ],
      };
    }

    case 'confidence_update':
      return {
        ...base,
        confidence: {
          value: payload.confidence ?? 0,
          reason: payload.reason ?? '',
          final: Boolean(payload.final),
        },
      };

    case 'final_verdict':
      return { ...base, verdict: payload.verdict, typing: {} };

    case 'debate_completed':
      return { ...base, status: 'completed', typing: {} };

    case 'debate_error':
      return {
        ...base,
        status: 'failed',
        typing: {},
        error: payload.message ?? 'O debate falhou.',
      };

    default:
      return base;
  }
}

function reducer(estado, acao) {
  switch (acao.type) {
    case 'reset':
      return { ...estadoInicial, seen: {} };

    case 'connection':
      return { ...estado, connected: acao.connected };

    case 'fail':
      return { ...estado, loading: false, error: acao.error };

    case 'not_found':
      return { ...estado, loading: false, notFound: true };

    case 'snapshot': {
      const debate = acao.debate;
      // Reaplica todos os eventos persistidos em ordem.
      let novo = {
        ...estado,
        loading: false,
        notFound: false,
        debate: {
          id: debate.id,
          question: debate.question,
          status: debate.status,
          createdAt: debate.createdAt,
          completedAt: debate.completedAt,
          mock: debate.mock,
          agents: debate.agents,
          judge: debate.judge,
        },
        agentsById: indexarAgentes(debate.agents, debate.judge),
        status: debate.status === 'running' ? 'running' : debate.status,
      };

      for (const evento of debate.events ?? []) {
        novo = aplicarEvento(novo, evento.type, evento);
      }

      // Estado final vindo do registro (caso algum evento tenha se perdido).
      if (debate.verdict && !novo.verdict) novo.verdict = debate.verdict;
      if (debate.status === 'failed' && debate.error && !novo.error) novo.error = debate.error;
      if (debate.status !== 'running') novo.typing = {};

      return novo;
    }

    case 'event':
      return aplicarEvento(estado, acao.eventType, acao.payload);

    default:
      return estado;
  }
}

/**
 * Acompanha um debate.
 * @param {string} debateId
 */
export function useDebateStream(debateId) {
  const [estado, dispatch] = useReducer(reducer, estadoInicial);

  /** Carrega o estado atual por REST (funciona mesmo se o WebSocket cair). */
  const carregar = useCallback(async () => {
    if (!debateId) return;
    try {
      const debate = await api.getDebate(debateId);
      dispatch({ type: 'snapshot', debate });
    } catch (error) {
      if (error.status === 404) dispatch({ type: 'not_found' });
      else dispatch({ type: 'fail', error: error.message });
    }
  }, [debateId]);

  useEffect(() => {
    if (!debateId) return undefined;

    dispatch({ type: 'reset' });
    carregar();

    const socket = getSocket();
    dispatch({ type: 'connection', connected: socket.connected });

    const aoConectar = () => dispatch({ type: 'connection', connected: true });
    const aoDesconectar = () => dispatch({ type: 'connection', connected: false });
    socket.on('connect', aoConectar);
    socket.on('disconnect', aoDesconectar);

    // Eventos do debate.
    const cancelarAssinatura = subscribe(EVENTOS_SOCKET, (type, payload) => {
      // Ignora eventos de outros debates (a conexao eh compartilhada).
      if (payload?.debateId && payload.debateId !== debateId) return;

      if (type === 'debate_snapshot') {
        dispatch({ type: 'snapshot', debate: payload });
        return;
      }
      if (type === 'debate_not_found') {
        dispatch({ type: 'not_found' });
        return;
      }
      dispatch({ type: 'event', eventType: type, payload });
    });

    const sair = joinDebate(debateId);

    return () => {
      socket.off('connect', aoConectar);
      socket.off('disconnect', aoDesconectar);
      cancelarAssinatura();
      sair();
    };
  }, [debateId, carregar]);

  /** Lista de agentes "digitando" agora, ja resolvida com nome/cor. */
  const typingAgents = useMemo(
    () =>
      Object.entries(estado.typing).map(([agentId, round]) => ({
        round,
        agent: estado.agentsById[agentId] ?? { id: agentId, name: agentId, avatar: '🤖' },
      })),
    [estado.typing, estado.agentsById],
  );

  return { ...estado, typingAgents, reload: carregar };
}

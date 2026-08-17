/**
 * ============================================================================
 *  CAMADA SOCKET.IO
 * ============================================================================
 * Cada debate tem uma "sala" (`debate:<id>`). O frontend entra na sala e recebe:
 *  1. `debate_snapshot` — tudo o que já aconteceu (resolve o caso de o usuário
 *     abrir/recarregar a página no meio do debate);
 *  2. os eventos ao vivo, um por um, conforme os agentes respondem.
 */

import { isAuthConfigured, verifyIdToken } from '../auth/firebase.js';

/** Eventos que NAO vao para o historico (sao apenas visuais e efemeros). */
const EVENTOS_EFEMEROS = new Set(['agent_typing']);

/** Nome da sala de um debate. */
export function roomName(debateId) {
  return `debate:${debateId}`;
}

/**
 * Registra os handlers de conexao.
 * @param {import('socket.io').Server} io
 * @param {object} db instancia retornada por initDb()
 */
export function initSockets(io, db) {
  // Mesma trava opcional das rotas REST: se API_TOKEN existir, o cliente precisa
  // enviar o token no handshake (`io(url, { auth: { token } })`).
  io.use((socket, next) => {
    const esperado = process.env.API_TOKEN;
    if (!esperado) return next();

    const recebido = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (recebido === esperado) return next();

    return next(new Error('Token de API inválido ou ausente.'));
  });

  // Identifica o usuário do Firebase, quando ele mandar o ID token no handshake.
  // Não barra quem não mandou: a checagem de dono acontece no join_debate.
  io.use(async (socket, next) => {
    const idToken = socket.handshake.auth?.firebaseToken;
    if (!isAuthConfigured() || !idToken) return next();

    try {
      socket.data.user = await verifyIdToken(idToken);
    } catch (erro) {
      console.warn(`[socket] token do Firebase recusado: ${erro.message}`);
    }
    return next();
  });

  io.on('connection', (socket) => {
    console.log(`[socket] conectado: ${socket.id}`);

    /**
     * Entrar na sala de um debate. Aceita callback de confirmacao (ack).
     * O cliente manda: socket.emit('join_debate', debateId, ack)
     */
    socket.on('join_debate', async (debateId, ack) => {
      if (typeof debateId !== 'string' || !debateId) {
        if (typeof ack === 'function') ack({ ok: false, error: 'debateId inválido' });
        return;
      }

      socket.join(roomName(debateId));

      try {
        const debate = await db.getDebate(debateId);
        if (!debate) {
          socket.emit('debate_not_found', { debateId });
          if (typeof ack === 'function') ack({ ok: false, error: 'debate não encontrado' });
          return;
        }

        // Debate com dono só vai ao ar para o dono.
        if (debate.ownerUid && debate.ownerUid !== socket.data.user?.uid) {
          socket.leave(roomName(debateId));
          socket.emit('debate_forbidden', { debateId });
          if (typeof ack === 'function') ack({ ok: false, error: 'debate de outra conta' });
          return;
        }

        // Snapshot com todo o estado atual (para reconstruir a tela).
        socket.emit('debate_snapshot', debate);
        if (typeof ack === 'function') ack({ ok: true, events: debate.events.length });
      } catch (error) {
        console.error('[socket] erro ao enviar snapshot:', error.message);
        if (typeof ack === 'function') ack({ ok: false, error: 'falha ao carregar o debate' });
      }
    });

    socket.on('leave_debate', (debateId) => {
      if (typeof debateId === 'string' && debateId) socket.leave(roomName(debateId));
    });

    socket.on('disconnect', (motivo) => {
      console.log(`[socket] desconectado: ${socket.id} (${motivo})`);
    });
  });
}

/**
 * Cria a funcao `emit` usada pelo orquestrador: persiste o evento no historico
 * e transmite para todos os clientes na sala do debate.
 *
 * @param {object} params
 * @param {import('socket.io').Server} params.io
 * @param {object} params.db
 * @param {string} params.debateId
 * @returns {(type: string, payload?: object) => Promise<void>}
 */
export function createEmitter({ io, db, debateId }) {
  const sala = roomName(debateId);

  return async function emit(type, payload = {}) {
    const evento = { type, debateId, ...payload };

    // Persiste primeiro (menos os efemeros), depois transmite: assim quem entrar
    // logo depois recebe um snapshot consistente.
    if (!EVENTOS_EFEMEROS.has(type)) {
      try {
        const registrado = await db.appendEvent(debateId, evento);
        if (registrado) {
          evento.seq = registrado.seq;
          evento.at = registrado.at;
        }
      } catch (error) {
        console.error(`[socket] falha ao persistir evento ${type}:`, error.message);
      }
    } else {
      evento.at = new Date().toISOString();
    }

    io.to(sala).emit(type, evento);
  };
}

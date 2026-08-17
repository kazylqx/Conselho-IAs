/**
 * ============================================================================
 *  CLIENTE WEBSOCKET (Socket.IO)
 * ============================================================================
 * Uma unica conexao compartilhada por toda a aplicacao. Cada debate eh uma
 * "sala": entramos com `join_debate` e recebemos o snapshot + os eventos ao vivo.
 */

import { io } from 'socket.io-client';
import { apiToken, backendUrl } from './api.js';
import { obterIdToken } from './firebase.js';

let socket = null;
/** ID token do Firebase enviado no handshake (atualizado no login/logout). */
let tokenDeUsuario = null;

/** Monta o objeto `auth` do handshake com o que existir. */
function credenciais() {
  const dados = {};
  if (apiToken) dados.token = apiToken;
  if (tokenDeUsuario) dados.firebaseToken = tokenDeUsuario;
  return dados;
}

/** Retorna (criando na primeira vez) a conexao com o backend. */
export function getSocket() {
  if (socket) return socket;

  socket = io(backendUrl, {
    // WebSocket primeiro; polling como reserva em redes que bloqueiam WS.
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    auth: credenciais(),
  });

  socket.on('connect_error', (error) => {
    console.warn('[socket] falha ao conectar:', error.message);
  });

  // Token expira em 1h: renova a credencial em cada reconexão.
  socket.io.on('reconnect_attempt', async () => {
    const atual = await obterIdToken();
    tokenDeUsuario = atual;
    socket.auth = credenciais();
  });

  return socket;
}

/**
 * Reabre a conexao com a identidade nova (chamado no login e no logout).
 * O backend le o token no handshake, entao trocar de usuario exige reconectar.
 *
 * @param {string|null} idToken
 */
export function reconectarSocket(idToken) {
  tokenDeUsuario = idToken ?? null;
  if (!socket) return;

  socket.auth = credenciais();
  socket.disconnect();
  socket.connect();
}

/**
 * Entra na sala de um debate.
 * @param {string} debateId
 * @param {(resposta: {ok: boolean, error?: string, events?: number}) => void} [onAck]
 */
export function joinDebate(debateId, onAck) {
  const s = getSocket();
  const entrar = () => s.emit('join_debate', debateId, (resposta) => onAck?.(resposta ?? { ok: false }));

  if (s.connected) entrar();
  // Reentra automaticamente depois de qualquer reconexao.
  s.on('connect', entrar);

  return () => {
    s.off('connect', entrar);
    s.emit('leave_debate', debateId);
  };
}

/**
 * Assina uma lista de eventos e devolve a funcao de limpeza.
 * @param {string[]} eventos
 * @param {(type: string, payload: object) => void} handler
 */
export function subscribe(eventos, handler) {
  const s = getSocket();
  const registrados = eventos.map((evento) => {
    const fn = (payload) => handler(evento, payload ?? {});
    s.on(evento, fn);
    return [evento, fn];
  });

  return () => registrados.forEach(([evento, fn]) => s.off(evento, fn));
}

/**
 * ============================================================================
 *  CLIENTE REST
 * ============================================================================
 * Toda conversa HTTP com o backend passa por aqui. A URL vem de
 * VITE_BACKEND_URL (definida no .env local ou no painel da Netlify).
 */

import { obterIdToken } from './firebase.js';

/** URL base do backend, sem barra no final. */
export const backendUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

/** Token opcional, espelho do API_TOKEN do backend. */
export const apiToken = import.meta.env.VITE_API_TOKEN || '';

/** Erro de API com status e codigo, para a UI reagir de forma especifica. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Wrapper de fetch: injeta headers, trata JSON e normaliza erros.
 * @param {string} path caminho a partir de /api
 * @param {RequestInit} [options]
 */
async function request(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (apiToken) headers['x-api-token'] = apiToken;

  // Identidade do Firebase: o backend usa para amarrar o debate ao usuário e
  // barrar leitura de debate de outra conta.
  const idToken = await obterIdToken();
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  let response;
  try {
    response = await fetch(`${backendUrl}/api${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      'Não foi possível falar com o backend. Ele está rodando? A URL em VITE_BACKEND_URL está certa?',
      { code: 'network_error' },
    );
  }

  const texto = await response.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = null;
  }

  if (!response.ok) {
    throw new ApiError(dados?.error || `Erro ${response.status} na requisição`, {
      status: response.status,
      code: dados?.code || 'http_error',
    });
  }

  return dados;
}

/** Estado de login exigido pelo backend (usado para decidir a UI). */
export async function estadoDoBackend() {
  return request('/health');
}

export const api = {
  /** Estado do backend (modo mock, busca web, uptime). */
  health: () => request('/health'),

  /** Conselho configurado: agentes, juiz e rótulos das rodadas. */
  roster: () => request('/agents'),

  /**
   * Inicia um debate.
   * @param {string} question
   * @returns {Promise<{id: string, question: string, agents: Array, judge: object, mock: boolean}>}
   */
  startDebate: (question) =>
    request('/debate', { method: 'POST', body: JSON.stringify({ question }) }),

  /** Debate completo, com todos os eventos já ocorridos. */
  getDebate: (id) => request(`/debate/${encodeURIComponent(id)}`),

  /** Histórico (resumos dos debates). */
  history: (limit = 50) => request(`/history?limit=${limit}`),

  /** Apaga um debate do histórico. */
  deleteDebate: (id) => request(`/debate/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

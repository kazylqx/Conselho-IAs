/**
 * ============================================================================
 *  AUTENTICACAO — verificacao de token do Firebase
 * ============================================================================
 * O frontend faz login com o Firebase (Google ou e-mail/senha) e manda o ID
 * token em `Authorization: Bearer <token>`. Aqui o backend confirma se o token
 * eh valido e de quem ele eh.
 *
 * POR QUE NAO USAMOS O firebase-admin:
 * o Admin SDK exige uma service account (segredo de verdade, JSON grande no
 * painel) e pesa alguns megabytes. A API REST oficial do Identity Toolkit
 * (`accounts:lookup`) valida o token usando apenas a chave web — que eh publica
 * por design. Menos dependencia, menos segredo para guardar, mesmo resultado:
 * token invalido/expirado eh recusado com INVALID_ID_TOKEN.
 *
 * Contrapartida: cada verificacao eh uma chamada HTTP. Por isso existe o cache
 * abaixo (o token vale 1h; guardamos por 5min).
 */

import { unauthorized } from '../utils/httpError.js';

const ENDPOINT = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

/** token -> { usuario, expiraEm } */
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;

/** true quando o backend sabe verificar login. */
export function isAuthConfigured() {
  return Boolean(process.env.FIREBASE_WEB_API_KEY);
}

/**
 * true quando login eh OBRIGATORIO para criar debate e ver historico.
 * Se o Firebase nao estiver configurado, o app roda em modo aberto (como antes).
 */
export function isAuthRequired() {
  if (!isAuthConfigured()) return false;
  return String(process.env.REQUIRE_AUTH ?? 'true').toLowerCase() !== 'false';
}

/** Limpa entradas vencidas (e segura o tamanho do cache). */
function limparCache() {
  const agora = Date.now();
  for (const [chave, valor] of cache) {
    if (valor.expiraEm <= agora) cache.delete(chave);
  }
  if (cache.size > CACHE_MAX) {
    const excedente = cache.size - CACHE_MAX;
    let removidos = 0;
    for (const chave of cache.keys()) {
      cache.delete(chave);
      if (++removidos >= excedente) break;
    }
  }
}

/**
 * Verifica o ID token e devolve o usuario.
 *
 * @param {string} idToken
 * @returns {Promise<{uid: string, email: string|null, name: string|null, picture: string|null}>}
 * @throws {HttpError} 401 quando o token eh invalido, expirado ou a conta esta desativada
 */
export async function verifyIdToken(idToken) {
  if (!idToken) throw unauthorized('Token de acesso ausente.', 'auth_missing_token');

  if (!isAuthConfigured()) {
    throw unauthorized(
      'Verificação de login não configurada no servidor (FIREBASE_WEB_API_KEY).',
      'auth_not_configured',
    );
  }

  const emCache = cache.get(idToken);
  if (emCache && emCache.expiraEm > Date.now()) return emCache.usuario;

  let resposta;
  try {
    resposta = await fetch(`${ENDPOINT}?key=${process.env.FIREBASE_WEB_API_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (erro) {
    // Rede caiu: não dá para afirmar que o token é inválido.
    throw unauthorized(
      `Não foi possível validar seu login agora (${erro.message}). Tente de novo.`,
      'auth_unavailable',
    );
  }

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const motivo = dados?.error?.message ?? `HTTP ${resposta.status}`;
    throw unauthorized(
      motivo === 'INVALID_ID_TOKEN' || motivo.startsWith('TOKEN_EXPIRED')
        ? 'Sua sessão expirou. Entre novamente.'
        : `Login inválido (${motivo}).`,
      'auth_invalid_token',
    );
  }

  const conta = dados?.users?.[0];
  if (!conta?.localId) {
    throw unauthorized('Conta não encontrada para este token.', 'auth_no_account');
  }
  if (conta.disabled) {
    throw unauthorized('Esta conta está desativada.', 'auth_disabled');
  }

  const usuario = {
    uid: conta.localId,
    email: conta.email ?? null,
    name: conta.displayName ?? null,
    picture: conta.photoUrl ?? null,
  };

  limparCache();
  cache.set(idToken, { usuario, expiraEm: Date.now() + CACHE_TTL_MS });

  return usuario;
}

/** Extrai o token do header Authorization (ou do handshake do socket). */
export function extrairToken(fonte) {
  const header = fonte?.get?.('authorization') ?? fonte?.authorization ?? '';
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

/**
 * ============================================================================
 *  MIDDLEWARES
 * ============================================================================
 * Sem autenticacao de usuario nesta versao (uso pessoal), mas com duas travas
 * simples para o caso da URL vazar:
 *  - token compartilhado opcional (API_TOKEN)
 *  - limite de requisicoes por IP, em memoria
 */

import { HttpError, tooManyRequests, unauthorized } from './httpError.js';
import {
  extrairToken,
  isAuthConfigured,
  isAuthRequired,
  verifyIdToken,
} from '../auth/firebase.js';

/**
 * Identifica o usuario a partir do ID token do Firebase.
 *
 * @param {object} [options]
 * @param {boolean} [options.required] true = sem login valido, nao passa
 *        (respeitando isAuthRequired: se o Firebase nao esta configurado, o app
 *        segue em modo aberto e a rota continua acessivel)
 */
export function createAuthMiddleware({ required = false } = {}) {
  return async function identificarUsuario(req, res, next) {
    const token = extrairToken(req.headers ? { authorization: req.get('authorization') } : null);

    // Sem Firebase no servidor: modo aberto, como antes do login existir.
    if (!isAuthConfigured()) return next();

    if (!token) {
      if (required && isAuthRequired()) {
        return next(unauthorized('Entre com sua conta para continuar.', 'auth_required'));
      }
      return next();
    }

    try {
      req.user = await verifyIdToken(token);
      return next();
    } catch (erro) {
      // Token ruim em rota opcional: segue sem usuário em vez de barrar a leitura.
      if (!required) return next();
      return next(erro);
    }
  };
}

/**
 * Exige o header `x-api-token` quando API_TOKEN estiver definido no ambiente.
 * Se API_TOKEN estiver vazio, a API fica aberta (comportamento padrao).
 */
export function apiTokenGuard(req, res, next) {
  const esperado = process.env.API_TOKEN;
  if (!esperado) return next();

  const recebido = req.get('x-api-token') || req.query.token;
  if (recebido === esperado) return next();

  return next(unauthorized('Token de API inválido ou ausente.', 'invalid_api_token'));
}

/**
 * Limitador de requisicoes bem simples (janela deslizante por IP, em memoria).
 * Suficiente para uso pessoal; nao sobrevive a restart, o que esta ok.
 *
 * @param {object} [options]
 * @param {number} [options.windowMs] tamanho da janela
 * @param {number} [options.max]      requisicoes permitidas na janela
 */
export function createRateLimiter({ windowMs = 60_000, max = 20 } = {}) {
  const acessos = new Map(); // ip -> number[] (timestamps)

  // Limpeza periodica para o Map nao crescer indefinidamente.
  const limpeza = setInterval(() => {
    const limite = Date.now() - windowMs;
    for (const [ip, marcas] of acessos) {
      const restantes = marcas.filter((marca) => marca > limite);
      if (restantes.length) acessos.set(ip, restantes);
      else acessos.delete(ip);
    }
  }, windowMs);
  limpeza.unref?.();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'desconhecido';
    const agora = Date.now();
    const marcas = (acessos.get(ip) ?? []).filter((marca) => marca > agora - windowMs);

    if (marcas.length >= max) {
      return next(
        tooManyRequests('Muitas requisições em pouco tempo. Tente novamente em instantes.'),
      );
    }

    marcas.push(agora);
    acessos.set(ip, marcas);
    return next();
  };
}

/** Handler 404 para rotas inexistentes sob /api. */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Rota não encontrada', path: req.originalUrl });
}

/** Handler central de erros: sempre responde JSON. */
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error instanceof HttpError ? error.status : 500;
  if (status >= 500) console.error('[http] erro:', error);

  res.status(status).json({
    error: status >= 500 ? 'Erro interno do servidor' : error.message,
    code: error.code ?? 'internal_error',
  });
}

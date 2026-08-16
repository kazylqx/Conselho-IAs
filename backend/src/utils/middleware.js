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

/**
 * ============================================================================
 *  MONTAGEM DAS ROTAS REST
 * ============================================================================
 * Tudo fica sob /api. O frontend so precisa conhecer VITE_BACKEND_URL.
 */

import { Router } from 'express';
import { createDebateRoutes } from './debate.routes.js';
import { getPublicRoster } from '../agents.config.js';
import { isMockMode } from '../agents/providers.js';
import { webSearch } from '../agents/webSearch.js';
import { apiTokenGuard, createRateLimiter } from '../utils/middleware.js';

/**
 * @param {object} deps
 * @param {import('socket.io').Server} deps.io
 * @param {object} deps.db
 */
export function createApiRouter({ io, db }) {
  const router = Router();

  // Limite geral, aplicado a todas as rotas da API.
  router.use(createRateLimiter({ windowMs: 60_000, max: 120 }));

  // Token compartilhado opcional (ativado apenas se API_TOKEN existir).
  router.use(apiTokenGuard);

  /** Estado do servico + quais recursos estao ativos. */
  router.get('/health', async (req, res) => {
    const busca = await webSearch('ping');
    res.json({
      ok: true,
      uptimeSeconds: Math.round(process.uptime()),
      mockMode: isMockMode(),
      webSearchImplemented: busca.implemented,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Conselho configurado (nomes, cores, papeis). O frontend usa isso para
   * desenhar avatares sem duplicar a configuracao.
   * Nao expoe chaves nem nomes de variaveis de ambiente.
   */
  router.get('/agents', (req, res) => {
    res.json(getPublicRoster());
  });

  router.use(createDebateRoutes({ io, db }));

  return router;
}

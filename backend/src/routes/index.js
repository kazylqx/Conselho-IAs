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
import { apiTokenGuard, createAuthMiddleware, createRateLimiter } from '../utils/middleware.js';
import { isAuthConfigured, isAuthRequired } from '../auth/firebase.js';

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

  // Identifica o usuário quando vier token do Firebase (sem barrar quem não mandou:
  // as rotas que exigem login usam o middleware com required: true).
  router.use(createAuthMiddleware({ required: false }));

  /** Estado do servico + quais recursos estao ativos. */
  router.get('/health', async (req, res) => {
    const busca = await webSearch('ping');
    res.json({
      ok: true,
      uptimeSeconds: Math.round(process.uptime()),
      mockMode: isMockMode(),
      webSearchImplemented: busca.implemented,
      // O frontend usa isso para saber se precisa exigir login antes de perguntar.
      authEnabled: isAuthConfigured(),
      authRequired: isAuthRequired(),
      timestamp: new Date().toISOString(),
    });
  });

  /** Quem sou eu (confere se o token chegou e foi aceito). */
  router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Sem login', code: 'auth_required' });
    return res.json({ user: req.user });
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

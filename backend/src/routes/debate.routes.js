/**
 * ============================================================================
 *  ROTAS DE DEBATE
 * ============================================================================
 *  POST   /api/debate       -> cria e dispara um debate (responde na hora com o id)
 *  GET    /api/debate/:id   -> debate completo, com todos os eventos
 *  DELETE /api/debate/:id   -> remove do historico
 *  GET    /api/history      -> resumos dos debates anteriores
 */

import { Router } from 'express';
import { startDebate, contarDebatesEmAndamento } from '../agents/debateRunner.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { createRateLimiter } from '../utils/middleware.js';

/**
 * @param {object} deps
 * @param {import('socket.io').Server} deps.io
 * @param {object} deps.db
 */
export function createDebateRoutes({ io, db }) {
  const router = Router();

  // Criar debate custa dinheiro de API: limite mais apertado nesta rota.
  const limitarCriacao = createRateLimiter({ windowMs: 60_000, max: 10 });

  /** Cria um debate novo. */
  router.post('/debate', limitarCriacao, async (req, res, next) => {
    try {
      const maxLen = Number.parseInt(process.env.MAX_QUESTION_LENGTH ?? '2000', 10) || 2000;
      const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';

      if (!question) {
        throw badRequest('Envie o campo "question" com a pergunta do debate.', 'question_required');
      }
      if (question.length < 5) {
        throw badRequest('A pergunta está curta demais para render um debate.', 'question_too_short');
      }
      if (question.length > maxLen) {
        throw badRequest(
          `A pergunta passou do limite de ${maxLen} caracteres.`,
          'question_too_long',
        );
      }

      const debate = await startDebate({ question, io, db });

      res.status(201).json({
        id: debate.id,
        question: debate.question,
        status: debate.status,
        createdAt: debate.createdAt,
        mock: debate.mock,
        agents: debate.agents,
        judge: debate.judge,
      });
    } catch (error) {
      next(error);
    }
  });

  /** Debate completo (usado ao abrir um debate antigo). */
  router.get('/debate/:id', async (req, res, next) => {
    try {
      const debate = await db.getDebate(req.params.id);
      if (!debate) throw notFound('Debate não encontrado.', 'debate_not_found');
      res.json(debate);
    } catch (error) {
      next(error);
    }
  });

  /** Remove um debate do historico. */
  router.delete('/debate/:id', async (req, res, next) => {
    try {
      const removido = await db.deleteDebate(req.params.id);
      if (!removido) throw notFound('Debate não encontrado.', 'debate_not_found');
      res.json({ ok: true, id: req.params.id });
    } catch (error) {
      next(error);
    }
  });

  /** Historico (resumos). */
  router.get('/history', async (req, res, next) => {
    try {
      const limite = Math.min(Number.parseInt(req.query.limit ?? '50', 10) || 50, 200);
      const debates = await db.listDebates({ limit: limite });
      res.json({ total: debates.length, running: contarDebatesEmAndamento(), debates });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

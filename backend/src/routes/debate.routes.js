/**
 * ============================================================================
 *  ROTAS DE DEBATE
 * ============================================================================
 *  POST   /api/debate       -> cria e dispara um debate (responde na hora com o id)
 *  GET    /api/debate/:id   -> debate completo, com todos os eventos
 *  DELETE /api/debate/:id   -> remove do historico
 *  GET    /api/history      -> resumos dos debates anteriores
 *
 * Quando o login esta ativo (FIREBASE_WEB_API_KEY no ambiente), cada debate
 * guarda o `ownerUid` de quem o criou e ninguem mais consegue ler, listar ou
 * apagar. Debate antigo, criado antes do login existir, fica sem dono e segue
 * acessivel — nao vamos apagar historico de ninguem por causa da migracao.
 */

import { Router } from 'express';
import { startDebate, contarDebatesEmAndamento } from '../agents/debateRunner.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { HttpError } from '../utils/httpError.js';
import { createAuthMiddleware, createRateLimiter } from '../utils/middleware.js';
import { isAuthRequired } from '../auth/firebase.js';

/** 403 quando o debate existe mas pertence a outra pessoa. */
function proibido(mensagem) {
  return new HttpError(403, mensagem, 'not_owner');
}

/**
 * Confere se quem pediu pode acessar o debate.
 * Regra: debate com dono só é acessível pelo dono. Sem dono, acesso liberado.
 */
function garantirAcesso(debate, usuario) {
  if (!debate.ownerUid) return;
  if (usuario?.uid && usuario.uid === debate.ownerUid) return;
  throw proibido('Este debate pertence a outra conta.');
}

/**
 * @param {object} deps
 * @param {import('socket.io').Server} deps.io
 * @param {object} deps.db
 */
export function createDebateRoutes({ io, db }) {
  const router = Router();

  // Criar debate custa cota de API: limite mais apertado nesta rota.
  const limitarCriacao = createRateLimiter({ windowMs: 60_000, max: 10 });
  const exigirLogin = createAuthMiddleware({ required: true });

  /** Cria um debate novo. */
  router.post('/debate', limitarCriacao, exigirLogin, async (req, res, next) => {
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

      const debate = await startDebate({ question, io, db, owner: req.user ?? null });

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
      garantirAcesso(debate, req.user);
      res.json(debate);
    } catch (error) {
      next(error);
    }
  });

  /** Remove um debate do histórico. */
  router.delete('/debate/:id', async (req, res, next) => {
    try {
      const debate = await db.getDebate(req.params.id);
      if (!debate) throw notFound('Debate não encontrado.', 'debate_not_found');
      garantirAcesso(debate, req.user);

      await db.deleteDebate(req.params.id);
      res.json({ ok: true, id: req.params.id });
    } catch (error) {
      next(error);
    }
  });

  /** Histórico (resumos) — só do usuário, quando o login está ativo. */
  router.get('/history', async (req, res, next) => {
    try {
      const limite = Math.min(Number.parseInt(req.query.limit ?? '50', 10) || 50, 200);

      if (isAuthRequired() && !req.user) {
        return res.json({ total: 0, running: contarDebatesEmAndamento(), debates: [] });
      }

      const debates = await db.listDebates({
        limit: limite,
        ownerUid: req.user?.uid ?? null,
        // Debates anteriores ao login continuam aparecendo para quem está logado.
        incluirSemDono: true,
      });

      return res.json({ total: debates.length, running: contarDebatesEmAndamento(), debates });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

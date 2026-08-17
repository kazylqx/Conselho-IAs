/**
 * ============================================================================
 *  CONSELHO DE IAs — SERVIDOR
 * ============================================================================
 * Express (REST) + Socket.IO (tempo real) no mesmo processo/porta.
 *
 * Local:        PORT=3000
 * SquareCloud:  PORT=80  (o balanceador da plataforma exige a porta 80 em
 *               aplicacoes web/API — veja o README)
 */

import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';

import { initDb } from './db/index.js';
import { initSockets } from './sockets/index.js';
import { createApiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './utils/middleware.js';
import { isMockMode } from './agents/providers.js';
import { getActiveAgents, judge } from './agents.config.js';

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;

/**
 * Monta a lista de origens permitidas no CORS a partir de FRONTEND_URL
 * (aceita varias separadas por virgula).
 */
function resolverOrigensPermitidas() {
  const configurado = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (configurado.length) return configurado;

  // Padrao de desenvolvimento: portas do Vite (dev e preview).
  console.warn(
    '[cors] FRONTEND_URL não definido. Liberando apenas localhost:5173 e localhost:4173.',
  );
  return ['http://localhost:5173', 'http://localhost:4173'];
}

const origensPermitidas = resolverOrigensPermitidas();

/** Regra de CORS compartilhada entre Express e Socket.IO. */
const corsOptions = {
  origin(origin, callback) {
    // Sem origin = chamada de servidor/curl/healthcheck: liberado.
    if (!origin) return callback(null, true);
    const normalizada = origin.replace(/\/+$/, '');
    if (origensPermitidas.includes(normalizada)) return callback(null, true);
    // Previews da Netlify (deploy-preview--xxx.netlify.app) do mesmo site.
    if (origensPermitidas.some((permitida) => permitida.endsWith('.netlify.app'))) {
      if (/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i.test(normalizada)) {
        return callback(null, true);
      }
    }
    return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  // Authorization eh onde vai o ID token do Firebase. Sem ele nesta lista o
  // navegador barra a requisicao no preflight, antes de sair do computador.
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-token'],
  credentials: false,
};

async function main() {
  const db = await initDb();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // atras do proxy da SquareCloud/Netlify

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '128kb' }));

  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: corsOptions,
    // Long-polling como reserva caso o WebSocket seja bloqueado por proxy.
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
  });

  initSockets(io, db);

  // Rota raiz: identificacao rapida do servico.
  app.get('/', (req, res) => {
    res.json({
      service: 'Conselho de IAs — API',
      status: 'online',
      mockMode: isMockMode(),
      endpoints: [
        'GET  /api/health',
        'GET  /api/agents',
        'POST /api/debate',
        'GET  /api/debate/:id',
        'GET  /api/history',
      ],
    });
  });

  app.use('/api', createApiRouter({ io, db }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  server.listen(PORT, () => {
    const nomes = getActiveAgents().map((agent) => `${agent.name} (${agent.role})`);
    console.log('');
    console.log('  ⚖️  Conselho de IAs — backend online');
    console.log(`  ➜  porta:      ${PORT}`);
    console.log(`  ➜  CORS:       ${origensPermitidas.join(', ')}`);
    console.log(`  ➜  conselho:   ${nomes.join(' | ')}`);
    console.log(`  ➜  juiz:       ${judge.name} (${judge.provider}/${judge.model})`);
    console.log(`  ➜  modo mock:  ${isMockMode() ? 'LIGADO (nenhuma API real será chamada)' : 'desligado'}`);
    console.log(`  ➜  API token:  ${process.env.API_TOKEN ? 'exigido' : 'não exigido (API aberta)'}`);
    console.log('');
  });

  /** Desligamento limpo: grava o banco antes de sair. */
  async function desligar(sinal) {
    console.log(`\n[server] recebido ${sinal}, encerrando...`);
    server.close();
    io.close();
    try {
      await db.close();
      console.log('[server] histórico salvo. Até logo.');
    } catch (error) {
      console.error('[server] falha ao salvar histórico:', error.message);
    } finally {
      process.exit(0);
    }
  }

  process.on('SIGINT', () => desligar('SIGINT'));
  process.on('SIGTERM', () => desligar('SIGTERM'));

  // Rede/API instavel nao deve derrubar o processo inteiro.
  process.on('unhandledRejection', (motivo) => {
    console.error('[server] promise rejeitada sem tratamento:', motivo);
  });
}

main().catch((error) => {
  console.error('[server] falha fatal na inicialização:', error);
  process.exit(1);
});

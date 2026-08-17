/**
 * ============================================================================
 *  Home — a landing page
 * ============================================================================
 * Estrutura: manchete + campo de pergunta como CTA central, o elenco do
 * conselho, as três rodadas explicadas visualmente e a porta para o histórico.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QuestionComposer } from '../components/QuestionComposer.jsx';
import { AgentEnsemble } from '../components/AgentEnsemble.jsx';
import { RoundsTimeline } from '../components/RoundsTimeline.jsx';
import { useBackendStatus } from '../hooks/useBackendStatus.js';
import { useDebateHistory } from '../hooks/useDebateHistory.js';
import { useAuth } from '../contexts/AuthProvider.jsx';
import { api } from '../services/api.js';
import { salvarResumo } from '../services/userHistory.js';
import { tempoRelativo } from '../utils/time.js';
import { resumir } from '../utils/format.jsx';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const backend = useBackendStatus();
  const { debates } = useDebateHistory(3);
  const { usuario, autenticado, habilitado, carregando: verificandoSessao } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  /** Com login ativo, perguntar exige conta (é o que separa os históricos). */
  const precisaEntrar = habilitado && !verificandoSessao && !autenticado;
  /** Enquanto o Firebase confere a sessão, não decidimos ainda o que mostrar. */
  const aguardandoSessao = habilitado && verificandoSessao;

  async function iniciarDebate(pergunta) {
    setEnviando(true);
    setErro(null);

    try {
      const debate = await api.startDebate(pergunta);

      // Registra na conta do usuário antes de sair da tela: assim o debate
      // aparece no histórico mesmo que ele feche a aba no meio.
      if (usuario?.uid) {
        await salvarResumo(usuario.uid, {
          id: debate.id,
          question: debate.question,
          status: 'running',
          createdAt: Date.now(),
          mock: Boolean(debate.mock),
          agentCount: debate.agents?.length ?? 0,
          confidence: null,
          preview: null,
          completedAt: null,
        }).catch((falha) => console.warn('[firestore] não salvei o resumo:', falha.message));
      }

      navigate(`/debate/${debate.id}`);
    } catch (error) {
      setErro(error.message);
      setEnviando(false);
    }
  }

  return (
    <div className="home">
      <div className="home__inner">
        {/* ------------------------------------------------------------ hero */}
        <header className="hero">
          <span className="eyebrow eyebrow--brass hero__eyebrow">
            <i className="hero__diamond" aria-hidden="true" /> debate multiagente em tempo real
          </span>

          <h1 className="hero__title">
            Várias IAs. Um debate.
            {/* O acento é bloco (não inline): ver Home.css, evita o clip do itálico */}
            <span className="hero__accent">Uma resposta em quem confiar.</span>
          </h1>

          <p className="hero__lead">
            Em vez de aceitar a resposta de um único modelo, coloque três para responder,
            discordar e revisar entre si — com busca na web quando o assunto pede dado atual.
            No fim, uma juíza consolida tudo e assina um nível de confiança.
          </p>

          <div className="hero__composer">
            {aguardandoSessao ? (
              <div className="hero__aguarde" role="status">
                <span className="hero__aguarde-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                verificando sua sessão…
              </div>
            ) : precisaEntrar ? (
              <div className="hero__gate">
                <div>
                  <span className="eyebrow eyebrow--brass">antes de começar</span>
                  <h2 className="hero__gate-title">Entre para convocar o conselho</h2>
                  <p className="muted hero__gate-text">
                    Cada conta tem seu próprio histórico: seus debates ficam salvos com
                    transcrição, fontes e veredito, e só você vê.
                  </p>
                </div>
                <div className="hero__gate-actions">
                  <Link to="/login" className="button button--primary">
                    Entrar ou criar conta
                  </Link>
                </div>
              </div>
            ) : (
              <QuestionComposer onSubmit={iniciarDebate} loading={enviando} error={erro} />
            )}
          </div>

          {!backend.loading && !backend.online && (
            <div className="notice notice--danger hero__notice">
              <span aria-hidden="true">⚠</span>
              <div>
                <strong>Backend offline.</strong>
                <p>
                  Não consegui falar com <code>{backend.url}</code>. Suba o backend
                  (<code>npm run dev</code> na pasta <code>backend</code>) ou ajuste
                  <code> VITE_BACKEND_URL</code>.
                </p>
              </div>
            </div>
          )}

          {backend.mockMode && (
            <div className="notice hero__notice">
              <span aria-hidden="true">🧪</span>
              <div>
                <strong>Modo simulado ligado.</strong>
                <p>
                  O backend está com <code>MOCK_AI=true</code>: as respostas são fictícias, mas
                  todo o fluxo funciona. Coloque as chaves no <code>.env</code> para valer.
                </p>
              </div>
            </div>
          )}
        </header>

        {/* --------------------------------------------------- conversas recentes */}
        {debates.length > 0 && (
          <section className="recent">
            <div className="recent__head">
              <span className="eyebrow">últimos debates</span>
              <Link to="/history" className="recent__all">
                ver o histórico completo <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="recent__row">
              {debates.map((debate) => (
                <Link key={debate.id} to={`/debate/${debate.id}`} className="recent__card">
                  <span className="recent__question">{resumir(debate.question, 84)}</span>
                  <span className="recent__meta mono">
                    {tempoRelativo(debate.createdAt)}
                    {debate.confidence != null && (
                      <>
                        {' · '}
                        <strong>{debate.confidence}%</strong> confiança
                      </>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <hr className="home__rule" />

        <AgentEnsemble />

        <hr className="home__rule" />

        <RoundsTimeline />

        {/* ------------------------------------------------------------ fecho */}
        <section className="closing">
          <h2 className="closing__title">Pronto para ouvir o conselho?</h2>
          <p className="closing__text muted">
            Cada debate fica salvo com a transcrição completa, as fontes consultadas e o veredito.
            Dá para reabrir e reler quando quiser.
          </p>
          <div className="closing__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                const campo = document.getElementById('pergunta');
                campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                campo?.focus({ preventScroll: true });
              }}
            >
              Fazer uma pergunta
            </button>
            <Link to="/history" className="button button--ghost">
              Ver debates anteriores
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 *  Debate — a sala ao vivo
 * ============================================================================
 * Cabeçalho fixo (pergunta, status, elenco presente e o mostrador de confiança)
 * + a sala de conversa ocupando o resto da tela. O ritmo da conversa é
 * controlado pelo DebateRoom (fila de apresentação).
 */

import { Link, useParams } from 'react-router-dom';
import { DebateRoom } from '../components/DebateRoom.jsx';
import { ConfidenceMeter } from '../components/ConfidenceMeter.jsx';
import { AgentAvatar } from '../components/AgentAvatar.jsx';
import { useDebateStream } from '../hooks/useDebateStream.js';
import { dataHora } from '../utils/time.js';
import './Debate.css';

/** Etiqueta de estado do debate. */
function StatusTag({ status, connected }) {
  if (status === 'completed') return <span className="tag tag--sage">concluído</span>;
  if (status === 'failed') return <span className="tag tag--clay">interrompido</span>;
  return (
    <span className={`tag ${connected ? 'tag--brass' : 'tag--ember'}`}>
      {connected ? (
        <>
          <i className="live-dot" aria-hidden="true" /> ao vivo
        </>
      ) : (
        'reconectando…'
      )}
    </span>
  );
}

export default function Debate() {
  const { id } = useParams();
  const {
    loading,
    notFound,
    error,
    connected,
    debate,
    agentsById,
    timeline,
    typingAgents,
    confidence,
    confidenceHistory,
    verdict,
    status,
  } = useDebateStream(id);

  if (notFound) {
    return (
      <div className="debate-empty">
        <span className="debate-empty__mark" aria-hidden="true">
          ⚖
        </span>
        <h2>Debate não encontrado</h2>
        <p className="muted">Esse debate não existe mais ou o histórico foi limpo no servidor.</p>
        <div className="debate-empty__actions">
          <Link to="/" className="button button--primary">
            Iniciar um novo debate
          </Link>
          <Link to="/history" className="button button--ghost">
            Ver histórico
          </Link>
        </div>
      </div>
    );
  }

  if (loading && !timeline.length) {
    return (
      <div className="debate-empty">
        <span className="debate-empty__mark debate-empty__mark--pulse" aria-hidden="true">
          ⚖
        </span>
        <h2>Abrindo a sala…</h2>
        <p className="muted">Carregando o debate.</p>
      </div>
    );
  }

  const participantes = debate?.agents ?? [];
  const valores = confidenceHistory.map((ponto) => ponto.value);

  return (
    <div className="debate">
      <header className="debate__header">
        <div className="debate__bar">
          <div className="debate__subject">
            <span className="eyebrow">pergunta em debate</span>
            <h1 className="debate__question">{debate?.question ?? '…'}</h1>

            <div className="debate__meta">
              <StatusTag status={status} connected={connected} />
              {debate?.mock && <span className="tag tag--ember">simulado</span>}
              {debate?.createdAt && (
                <span className="debate__date mono">{dataHora(debate.createdAt)}</span>
              )}
            </div>
          </div>

          <div className="debate__meter">
            <ConfidenceMeter
              value={verdict?.confidence ?? confidence.value}
              reason={confidence.reason}
              final={Boolean(verdict) || confidence.final}
              history={valores}
              size="md"
            />
          </div>
        </div>

        {participantes.length > 0 && (
          <div className="debate__cast">
            {participantes.map((agent) => {
              const falhou = (verdict?.failedAgents ?? []).includes(agent.id);
              const pensando = typingAgents.some((item) => item.agent.id === agent.id);
              return (
                <span
                  className={`debate__member ${pensando ? 'is-thinking' : ''}`}
                  key={agent.id}
                  title={`${agent.name} — ${agent.role}`}
                  style={{ '--agent-color': agent.color }}
                >
                  <AgentAvatar agent={agent} size={24} typing={pensando} failed={falhou} />
                  <span className="debate__member-name">{agent.name}</span>
                </span>
              );
            })}

            {debate?.judge && (
              <span
                className="debate__member debate__member--judge"
                title={`${debate.judge.name} — ${debate.judge.role}`}
                style={{ '--agent-color': debate.judge.color }}
              >
                <AgentAvatar agent={debate.judge} size={24} />
                <span className="debate__member-name">{debate.judge.name}</span>
              </span>
            )}
          </div>
        )}
      </header>

      <DebateRoom
        timeline={timeline}
        agentsById={agentsById}
        typingAgents={typingAgents}
        verdict={verdict}
        status={status}
        error={error}
        agents={participantes}
        confidenceHistory={valores}
      />

      {status !== 'running' && (
        <footer className="debate__footer">
          <Link to="/" className="button button--primary">
            Novo debate
          </Link>
          <Link to="/history" className="button button--ghost">
            Histórico
          </Link>
        </footer>
      )}
    </div>
  );
}

/**
 * ============================================================================
 *  Debate — a sala do debate
 * ============================================================================
 * Cabeçalho fixo com a pergunta, status e barra de confiança + a sala de chat
 * (DebateRoom) ocupando o resto da tela.
 */

import { Link, useParams } from 'react-router-dom';
import { DebateRoom } from '../components/DebateRoom.jsx';
import { ConfidenceBar } from '../components/ConfidenceBar.jsx';
import { AgentAvatar } from '../components/AgentAvatar.jsx';
import { useDebateStream } from '../hooks/useDebateStream.js';
import { dataHora } from '../utils/time.js';
import './Debate.css';

/** Etiqueta de status do debate. */
function StatusChip({ status, connected }) {
  if (status === 'completed') return <span className="chip chip--success">concluído</span>;
  if (status === 'failed') return <span className="chip chip--danger">falhou</span>;
  return (
    <span className={`chip ${connected ? 'chip--accent' : 'chip--warn'}`}>
      {connected ? 'ao vivo' : 'reconectando…'}
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
    verdict,
    status,
  } = useDebateStream(id);

  if (notFound) {
    return (
      <div className="debate__empty">
        <h2>Debate não encontrado</h2>
        <p className="muted">
          Esse debate não existe mais (ou o histórico foi limpo no servidor).
        </p>
        <div className="debate__empty-actions">
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
      <div className="debate__empty">
        <h2>Convocando o conselho…</h2>
        <p className="muted">Carregando o debate.</p>
      </div>
    );
  }

  const participantes = debate?.agents ?? [];

  return (
    <div className="debate">
      <header className="debate__header">
        <div className="debate__question-row">
          <div className="debate__question-block">
            <span className="debate__label">Pergunta em debate</span>
            <h1 className="debate__question">{debate?.question ?? '...'}</h1>
            <div className="debate__meta">
              <StatusChip status={status} connected={connected} />
              {debate?.mock && <span className="chip chip--warn">simulado</span>}
              {debate?.createdAt && (
                <span className="faint">{dataHora(debate.createdAt)}</span>
              )}
            </div>
          </div>

          <div className="debate__confidence">
            <ConfidenceBar
              value={verdict?.confidence ?? confidence.value}
              reason={confidence.reason}
              final={Boolean(verdict) || confidence.final}
            />
          </div>
        </div>

        {participantes.length > 0 && (
          <div className="debate__participants">
            {participantes.map((agent) => {
              const falhou = (verdict?.failedAgents ?? []).includes(agent.id);
              const digitando = typingAgents.some((item) => item.agent.id === agent.id);
              return (
                <span className="debate__participant" key={agent.id} title={`${agent.name} — ${agent.role}`}>
                  <AgentAvatar agent={agent} size={26} typing={digitando} failed={falhou} />
                  <span style={{ color: agent.color }}>{agent.name}</span>
                </span>
              );
            })}
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

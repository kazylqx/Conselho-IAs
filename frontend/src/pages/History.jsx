/**
 * ============================================================================
 *  History — debates anteriores
 * ============================================================================
 * Lista tudo que está salvo no backend (arquivo JSON local). Dá para reabrir
 * qualquer debate: os eventos ficam guardados e a sala é reconstruída.
 */

import { Link } from 'react-router-dom';
import { useDebateHistory } from '../hooks/useDebateHistory.js';
import { dataHora, tempoRelativo } from '../utils/time.js';
import './History.css';

/** Cor da etiqueta conforme o status. */
function StatusChip({ status }) {
  if (status === 'completed') return <span className="chip chip--success">concluído</span>;
  if (status === 'failed') return <span className="chip chip--danger">falhou</span>;
  return <span className="chip chip--accent">em andamento</span>;
}

export default function History() {
  const { debates, loading, error, refresh, remover } = useDebateHistory(100);

  return (
    <div className="history">
      <div className="history__inner">
        <header className="history__header">
          <div>
            <h1>Histórico de debates</h1>
            <p className="muted" style={{ margin: 0 }}>
              {debates.length} debate(s) salvos no backend.
            </p>
          </div>
          <div className="history__actions">
            <button type="button" className="button button--ghost" onClick={refresh}>
              ↻ Atualizar
            </button>
            <Link to="/" className="button button--primary">
              + Novo debate
            </Link>
          </div>
        </header>

        {error && (
          <div className="alert alert--danger">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {loading && <p className="faint">Carregando…</p>}

        {!loading && !debates.length && (
          <div className="card history__empty">
            <h2>Nada por aqui ainda</h2>
            <p className="muted">
              Assim que o conselho debater a primeira pergunta, ela aparece nesta lista.
            </p>
            <Link to="/" className="button button--primary">
              Fazer a primeira pergunta
            </Link>
          </div>
        )}

        <div className="history__grid">
          {debates.map((debate) => (
            <article className="history__card" key={debate.id}>
              <Link to={`/debate/${debate.id}`} className="history__card-link">
                <div className="history__card-top">
                  <StatusChip status={debate.status} />
                  {debate.mock && <span className="chip chip--warn">simulado</span>}
                  {debate.confidence != null && (
                    <span className="history__confidence">{debate.confidence}%</span>
                  )}
                </div>

                <h3 className="history__question">{debate.question}</h3>

                <p className="history__meta">
                  {tempoRelativo(debate.createdAt)} · {dataHora(debate.createdAt)} ·{' '}
                  {debate.agentCount} conselheiros
                </p>
              </Link>

              <button
                type="button"
                className="button button--danger history__delete"
                onClick={() => remover(debate.id)}
                title="Apagar debate"
              >
                Apagar
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

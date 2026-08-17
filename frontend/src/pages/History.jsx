/**
 * ============================================================================
 *  History — lista de conversas
 * ============================================================================
 * Comporta-se como um app de mensagens: cada linha é uma conversa com prévia da
 * resposta final, quando aconteceu e a confiança do veredito. Excluir remove na
 * hora e abre a janela de "Desfazer" (o DELETE só sai no fim da janela).
 */

import { Link } from 'react-router-dom';
import { HistoryItem } from '../components/HistoryItem.jsx';
import { UndoToast } from '../components/UndoToast.jsx';
import { useDebateHistory, JANELA_DESFAZER_MS } from '../hooks/useDebateHistory.js';
import './History.css';

export default function History() {
  const { debates, loading, error, refresh, remover, desfazer, pendente } = useDebateHistory(100);

  const emAndamento = debates.filter((debate) => debate.status === 'running').length;

  return (
    <div className="history">
      <div className="history__inner">
        <header className="history__head">
          <div>
            <span className="eyebrow eyebrow--brass">arquivo do conselho</span>
            <h1 className="history__title">Debates anteriores</h1>
            <p className="history__lead muted">
              {loading
                ? 'Carregando…'
                : `${debates.length} debate(s) salvos${emAndamento ? ` · ${emAndamento} em andamento` : ''}.`}
            </p>
          </div>

          <div className="history__actions">
            <button type="button" className="button button--ghost button--sm" onClick={refresh}>
              ↻ Atualizar
            </button>
            <Link to="/" className="button button--primary button--sm">
              + Novo debate
            </Link>
          </div>
        </header>

        {error && (
          <div className="notice notice--danger">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {!loading && !debates.length && (
          <section className="history__empty">
            <span className="history__empty-mark" aria-hidden="true">
              ⚖
            </span>
            <h2>O arquivo está vazio</h2>
            <p className="muted">
              Ainda nenhum debate por aqui. Faça a primeira pergunta e o conselho começa a
              trabalhar — a transcrição, as fontes e o veredito ficam guardados nesta página.
            </p>
            <Link to="/" className="button button--primary">
              Fazer a primeira pergunta
            </Link>
          </section>
        )}

        {debates.length > 0 && (
          <div className="history__list">
            {debates.map((debate) => (
              <HistoryItem key={debate.id} debate={debate} onDelete={remover} />
            ))}
          </div>
        )}
      </div>

      {pendente && (
        <UndoToast
          message="Debate excluído."
          duration={JANELA_DESFAZER_MS}
          onUndo={() => desfazer(pendente.id)}
        />
      )}
    </div>
  );
}

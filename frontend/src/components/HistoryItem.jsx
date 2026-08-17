/**
 * ============================================================================
 *  HistoryItem — uma conversa na lista de histórico
 * ============================================================================
 * Formato de app de mensagens: mostrador de confiança à esquerda, pergunta em
 * destaque, prévia da resposta final, quando aconteceu e o botão de excluir.
 */

import { Link } from 'react-router-dom';
import { ConfidenceMeter } from './ConfidenceMeter.jsx';
import { dataHora, tempoRelativo } from '../utils/time.js';
import './HistoryItem.css';

/** Ícone de lixeira (sem biblioteca de ícones). */
function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1ZM6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Texto de apoio quando ainda não existe resposta final. */
function previaDeApoio(debate) {
  if (debate.status === 'running') return 'Debate em andamento…';
  if (debate.status === 'failed') return 'O debate foi interrompido antes do veredito.';
  return 'Sem resposta final registrada.';
}

/**
 * @param {object} props
 * @param {object} props.debate resumo vindo de GET /api/history
 * @param {(debate: object) => void} props.onDelete
 */
export function HistoryItem({ debate, onDelete }) {
  const temConfianca = debate.confidence != null;

  return (
    <article className="conv">
      <Link to={`/debate/${debate.id}`} className="conv__link">
        <div className="conv__dial">
          {temConfianca ? (
            <ConfidenceMeter value={debate.confidence} size="sm" showLabel={false} final />
          ) : (
            <span className={`conv__badge conv__badge--${debate.status}`} aria-hidden="true">
              {debate.status === 'running' ? '···' : '—'}
            </span>
          )}
        </div>

        <div className="conv__body">
          <header className="conv__top">
            <h3 className="conv__question">{debate.question}</h3>
            <time className="conv__time mono" title={dataHora(debate.createdAt)}>
              {tempoRelativo(debate.createdAt)}
            </time>
          </header>

          <p className="conv__preview">{debate.preview || previaDeApoio(debate)}</p>

          <footer className="conv__tags">
            {debate.status === 'running' && <span className="tag tag--brass">ao vivo</span>}
            {debate.status === 'failed' && <span className="tag tag--clay">falhou</span>}
            {debate.mock && <span className="tag tag--ember">simulado</span>}
            <span className="tag">{debate.agentCount} conselheiros</span>
          </footer>
        </div>
      </Link>

      <button
        type="button"
        className="conv__delete"
        onClick={() => onDelete(debate)}
        title="Excluir debate"
        aria-label={`Excluir debate: ${debate.question}`}
      >
        <TrashIcon />
      </button>
    </article>
  );
}

/**
 * ============================================================================
 *  SearchCard — uma busca na web dentro do debate
 * ============================================================================
 * Aparece em dois casos:
 *  - busca compartilhada da rodada 1 (sem agente: vale para todos)
 *  - verificação que um agente pediu na rodada 2 ("BUSCAR: ...")
 *
 * Os números [1], [2]... são os mesmos que os agentes e o juiz citam.
 */

import { horaCurta } from '../utils/time.js';
import './SearchCard.css';

/**
 * @param {object} props
 * @param {object} [props.agent] agente que pediu a busca (ausente = busca compartilhada)
 * @param {object} props.item    item da timeline (kind: 'search')
 */
export function SearchCard({ agent, item }) {
  const cor = agent?.color ?? '#4ecdc4';
  const titulo =
    item.shared || !agent ? 'Busca na web para a pergunta' : `${agent.name} verificou na web`;

  return (
    <article className="search-card" style={{ '--agent-color': cor }}>
      <span className="search-card__icon" aria-hidden="true">
        🔎
      </span>

      <div className="search-card__body">
        <header className="search-card__head">
          <span className="search-card__title">{titulo}</span>
          <span className="search-card__query">“{item.query}”</span>
          {item.cached && <span className="chip">reaproveitada</span>}
          <span className="search-card__time">{horaCurta(item.at)}</span>
        </header>

        {item.available && item.results?.length ? (
          <ul className="search-card__results">
            {item.results.map((fonte) => (
              <li key={fonte.url}>
                <a
                  href={fonte.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="search-card__link"
                >
                  <span className="search-card__number">[{fonte.n}]</span> {fonte.title}
                </a>
                <span className="search-card__meta">
                  {fonte.source}
                  {fonte.publishedAt ? ` · ${fonte.publishedAt}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="search-card__empty">
            {item.note || 'A busca não retornou resultados utilizáveis.'}
          </p>
        )}
      </div>
    </article>
  );
}

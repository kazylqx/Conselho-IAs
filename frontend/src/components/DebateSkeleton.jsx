/**
 * Esqueleto de carregamento da sala: aparece entre o "iniciar debate" e a
 * primeira fala. Usa os avatares reais dos conselheiros — o usuário já vê quem
 * está entrando na sala em vez de encarar retângulos cinzas.
 */

import { AgentAvatar } from './AgentAvatar.jsx';
import './DebateSkeleton.css';

/**
 * @param {object} props
 * @param {Array} [props.agents] agentes do debate (opcional)
 */
export function DebateSkeleton({ agents = [] }) {
  const linhas = agents.length ? agents.slice(0, 3) : [null, null, null];

  return (
    <div className="skeleton" aria-hidden="true">
      <div className="skeleton__chapter">
        <span className="skeleton__rule" />
        <span className="skeleton__chapter-label">
          <i className="skeleton__diamond" />
          convocando o conselho
        </span>
        <span className="skeleton__rule" />
      </div>

      {linhas.map((agent, indice) => (
        <div className="skeleton__row" key={agent?.id ?? indice} style={{ '--delay': `${indice * 120}ms` }}>
          {agent ? (
            <AgentAvatar agent={agent} size={40} typing />
          ) : (
            <span className="skeleton__avatar" />
          )}

          <div className="skeleton__bubble">
            <div className="skeleton__head">
              <span className="skeleton__line skeleton__line--name" />
              <span className="skeleton__line skeleton__line--role" />
            </div>
            <span className="skeleton__line" style={{ width: '96%' }} />
            <span className="skeleton__line" style={{ width: '88%' }} />
            <span className="skeleton__line" style={{ width: '64%' }} />
          </div>
        </div>
      ))}

      <p className="skeleton__hint">
        Cada IA está formando a resposta sem ver as outras. Isso leva alguns segundos.
      </p>
    </div>
  );
}

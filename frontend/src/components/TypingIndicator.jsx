/**
 * Indicador de "digitando...": aparece antes da resposta de cada agente,
 * o que dá a sensação de debate ao vivo.
 */

import { AgentAvatar } from './AgentAvatar.jsx';
import './TypingIndicator.css';

/**
 * @param {object} props
 * @param {{agent: object, round: number}[]} props.agents agentes digitando agora
 */
export function TypingIndicator({ agents = [] }) {
  if (!agents.length) return null;

  return (
    <div className="typing-list" aria-live="polite">
      {agents.map(({ agent }) => (
        <div
          className="typing"
          key={agent.id}
          style={{ '--agent-color': agent.color ?? '#7c9cff' }}
        >
          <AgentAvatar agent={agent} size={34} typing />
          <div className="typing__bubble">
            <span className="typing__name">{agent.name}</span>
            <span className="typing__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="typing__sr">está digitando</span>
          </div>
        </div>
      ))}
    </div>
  );
}

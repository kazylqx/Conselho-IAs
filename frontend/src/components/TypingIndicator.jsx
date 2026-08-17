/**
 * "Está pensando…" — três pontos que respiram na cor do agente.
 * Aparece só quando a fila de apresentação está em dia, para não anunciar um
 * agente cuja resposta ainda está esperando para entrar na tela.
 */

import { AgentAvatar } from './AgentAvatar.jsx';
import './TypingIndicator.css';

/**
 * @param {object} props
 * @param {{agent: object, round: number}[]} props.agents agentes pensando agora
 */
export function TypingIndicator({ agents = [] }) {
  if (!agents.length) return null;

  return (
    <div className="typing-stack" aria-live="polite">
      {agents.map(({ agent, round }) => (
        <div
          className="typing"
          key={agent.id}
          style={{ '--agent-color': agent.color ?? 'var(--brass)' }}
        >
          <AgentAvatar agent={agent} size={34} typing />

          <div className="typing__pill">
            <span className="typing__name">{agent.name}</span>
            <span className="typing__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="sr-only">
              está {round === 3 ? 'redigindo o veredito' : 'pensando'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

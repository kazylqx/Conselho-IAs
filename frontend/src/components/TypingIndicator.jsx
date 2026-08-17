/**
 * Quem está com a palavra. Durante o turno anunciado, aparece um único agente —
 * é o que dá a leitura de "um de cada vez". Quando a fila está em dia, mostra
 * quem o backend reporta, em linha, sem empilhar cartões.
 */

import { AgentAvatar } from './AgentAvatar.jsx';
import './TypingIndicator.css';

/** Verbo conforme a etapa. */
function acao(round) {
  if (round === 3) return 'redigindo o veredito';
  if (round === 2) return 'preparando a réplica';
  return 'formulando a resposta';
}

/**
 * @param {object} props
 * @param {{agent: object, round: number}[]} props.agents
 */
export function TypingIndicator({ agents = [] }) {
  if (!agents.length) return null;

  return (
    <div className="floor" aria-live="polite">
      {agents.map(({ agent, round }) => (
        <div
          className="floor__speaker"
          key={agent.id}
          style={{ '--agent-color': agent.color ?? 'var(--brass)' }}
        >
          <AgentAvatar agent={agent} size={30} typing />

          <span className="floor__label">
            <span className="floor__name">{agent.name}</span>
            <span className="floor__action">{acao(round)}</span>
          </span>

          <span className="floor__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      ))}
    </div>
  );
}

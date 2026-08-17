/**
 * Avatar de um conselheiro: emoji (ou inicial) dentro de um selo circular com a
 * cor do agente, definida em agents.config.js no backend.
 */

import './AgentAvatar.css';

/**
 * @param {object} props
 * @param {{id: string, name: string, avatar?: string, color?: string}} props.agent
 * @param {number} [props.size]    diâmetro em px
 * @param {boolean} [props.typing] anel pulsando (agente pensando)
 * @param {boolean} [props.failed] apagado (agente que não respondeu)
 */
export function AgentAvatar({ agent, size = 42, typing = false, failed = false }) {
  const cor = agent?.color ?? 'var(--brass)';
  const conteudo = agent?.avatar || agent?.name?.slice(0, 1)?.toUpperCase() || '?';

  const classes = ['avatar', typing && 'avatar--typing', failed && 'avatar--failed']
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classes}
      style={{
        '--agent-color': cor,
        '--pulse-color': cor,
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.round(size * 0.46)}px`,
      }}
      title={agent?.name}
      aria-hidden="true"
    >
      <span className="avatar__glyph">{conteudo}</span>
    </span>
  );
}

/**
 * Avatar de um agente: emoji (ou inicial) dentro de um circulo com a cor
 * definida no agents.config.js do backend.
 */

import './AgentAvatar.css';

/**
 * @param {object} props
 * @param {{id: string, name: string, avatar?: string, color?: string}} props.agent
 * @param {number} [props.size]    diametro em px
 * @param {boolean} [props.typing] anel pulsando (agente digitando)
 * @param {boolean} [props.failed] visual apagado (agente que falhou)
 */
export function AgentAvatar({ agent, size = 42, typing = false, failed = false }) {
  const cor = agent?.color ?? '#7c9cff';
  const conteudo = agent?.avatar || agent?.name?.slice(0, 1)?.toUpperCase() || '?';

  const classes = [
    'agent-avatar',
    typing ? 'agent-avatar--typing' : '',
    failed ? 'agent-avatar--failed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classes}
      style={{
        '--avatar-color': cor,
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.round(size * 0.48)}px`,
      }}
      title={agent?.name}
      aria-hidden="true"
    >
      {conteudo}
    </span>
  );
}

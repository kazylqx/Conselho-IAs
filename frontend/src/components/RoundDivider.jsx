/** Divisor de rodada: separa visualmente as três etapas do debate. */

import './RoundDivider.css';

/**
 * @param {object} props
 * @param {number} props.round número da rodada (1, 2 ou 3)
 * @param {string} props.label rótulo vindo do backend
 */
export function RoundDivider({ round, label }) {
  return (
    <div className={`round-divider round-divider--${round}`}>
      <span className="round-divider__badge">{round}</span>
      <span className="round-divider__label">{label}</span>
    </div>
  );
}

/**
 * Barra de confiança animada. Sobe/desce conforme o debate avança e fica
 * destacada quando o valor final vem do juiz.
 */

import './ConfidenceBar.css';

/** Cor e rótulo de acordo com a faixa de confiança. */
function faixa(valor) {
  if (valor >= 80) return { cor: 'var(--success)', rotulo: 'alta' };
  if (valor >= 60) return { cor: '#a3e635', rotulo: 'boa' };
  if (valor >= 40) return { cor: 'var(--warn)', rotulo: 'moderada' };
  if (valor >= 20) return { cor: '#fb923c', rotulo: 'baixa' };
  return { cor: 'var(--danger)', rotulo: 'muito baixa' };
}

/**
 * @param {object} props
 * @param {number} props.value    0 a 100
 * @param {string} [props.reason] explicação curta do valor atual
 * @param {boolean} [props.final] true quando o juiz já definiu a confiança
 * @param {boolean} [props.compact]
 */
export function ConfidenceBar({ value = 0, reason = '', final = false, compact = false }) {
  const valor = Math.max(0, Math.min(100, Math.round(value)));
  const { cor, rotulo } = faixa(valor);

  return (
    <div
      className={`confidence ${compact ? 'confidence--compact' : ''} ${
        final ? 'confidence--final' : ''
      }`}
      style={{ '--confidence-color': cor }}
    >
      <div className="confidence__head">
        <span className="confidence__label">
          Confiança {final ? 'final' : 'parcial'}
          <span className="confidence__level"> · {rotulo}</span>
        </span>
        <strong className="confidence__value">{valor}%</strong>
      </div>

      <div
        className="confidence__track"
        role="progressbar"
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Nível de confiança do conselho"
      >
        <div className="confidence__fill" style={{ width: `${valor}%` }} />
      </div>

      {reason && !compact && <p className="confidence__reason">{reason}</p>}
    </div>
  );
}

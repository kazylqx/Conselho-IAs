/**
 * ============================================================================
 *  ConfidenceMeter — a convicção do conselho
 * ============================================================================
 * Não é uma barra de progresso: é um mostrador. O anel preenche conforme o
 * debate avança, a cor migra de barro (dúvida) para sálvia (convicção), e as
 * marcas embaixo mostram o caminho que a confiança fez até aqui — dá para ver
 * se o conselho foi ganhando ou perdendo certeza.
 */

import './ConfidenceMeter.css';

/** Cor e rótulo por faixa. */
function faixa(valor) {
  if (valor >= 80) return { cor: 'var(--sage)', rotulo: 'alta' };
  if (valor >= 60) return { cor: 'var(--brass)', rotulo: 'boa' };
  if (valor >= 40) return { cor: 'var(--ember)', rotulo: 'moderada' };
  if (valor >= 20) return { cor: 'var(--clay)', rotulo: 'baixa' };
  return { cor: 'var(--clay)', rotulo: 'mínima' };
}

const TAMANHOS = {
  sm: { box: 58, stroke: 4, fonte: 'var(--text-sm)' },
  md: { box: 92, stroke: 6, fonte: 'var(--text-xl)' },
  lg: { box: 128, stroke: 8, fonte: 'var(--text-2xl)' },
};

/**
 * @param {object} props
 * @param {number} props.value        0 a 100
 * @param {boolean} [props.final]     true quando o juiz já fechou o número
 * @param {string} [props.reason]     explicação curta do valor atual
 * @param {number[]} [props.history]   valores anteriores, para as marcas
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.showLabel]
 */
export function ConfidenceMeter({
  value = 0,
  final = false,
  reason = '',
  history = [],
  size = 'md',
  showLabel = true,
}) {
  const valor = Math.max(0, Math.min(100, Math.round(value)));
  const { cor, rotulo } = faixa(valor);
  const { box, stroke, fonte } = TAMANHOS[size] ?? TAMANHOS.md;

  const raio = (box - stroke) / 2;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = circunferencia * (valor / 100);

  return (
    <div
      className={`meter meter--${size} ${final ? 'meter--final' : ''}`}
      style={{ '--meter-color': cor }}
    >
      <div className="meter__dial" style={{ width: box, height: box }}>
        <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
          {/* trilha */}
          <circle
            cx={box / 2}
            cy={box / 2}
            r={raio}
            fill="none"
            stroke="var(--line)"
            strokeWidth={stroke}
          />
          {/* preenchimento */}
          <circle
            className="meter__arc"
            cx={box / 2}
            cy={box / 2}
            r={raio}
            fill="none"
            stroke="var(--meter-color)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${preenchido} ${circunferencia}`}
            transform={`rotate(-90 ${box / 2} ${box / 2})`}
          />
        </svg>

        <div className="meter__value" style={{ fontSize: fonte }}>
          <span
            className="mono"
            role="progressbar"
            aria-valuenow={valor}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Nível de confiança do conselho"
          >
            {valor}
          </span>
          <i>%</i>
        </div>
      </div>

      {showLabel && (
        <div className="meter__info">
          <span className="eyebrow">confiança {final ? 'final' : 'parcial'}</span>
          <strong className="meter__level">{rotulo}</strong>

          {history.length > 1 && (
            <div className="meter__trail" title="evolução da confiança durante o debate">
              {history.slice(-8).map((ponto, indice) => (
                <span
                  key={indice}
                  className="meter__tick"
                  style={{ height: `${Math.max(3, (ponto / 100) * 18)}px` }}
                />
              ))}
            </div>
          )}

          {reason && <p className="meter__reason">{reason}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Marcador de capítulo entre as rodadas. Funciona como respiro visual: linha
 * fina dos dois lados, número em mono e o nome da etapa em serifada.
 */

import './RoundDivider.css';

/** Nomes curtos das etapas (o backend manda o rótulo longo). */
const TITULOS = {
  1: 'Respostas iniciais',
  2: 'Debate',
  3: 'Veredito final',
};

const SUBTITULOS = {
  1: 'cada IA responde sem ver as outras',
  2: 'agora elas leem, contestam e revisam',
  3: 'a juíza consolida o que ficou de pé',
};

/**
 * @param {object} props
 * @param {number} props.round número da rodada (1, 2 ou 3)
 * @param {string} [props.label] rótulo vindo do backend (reserva)
 */
export function RoundDivider({ round, label }) {
  const titulo = TITULOS[round] ?? label ?? `Rodada ${round}`;
  const subtitulo = SUBTITULOS[round];

  return (
    <div className={`chapter chapter--${round}`} role="separator" aria-label={titulo}>
      <span className="chapter__rule" />

      <span className="chapter__center">
        <span className="chapter__mark">
          <i className="chapter__diamond" aria-hidden="true" />
          <span className="mono chapter__number">{String(round).padStart(2, '0')}</span>
        </span>
        <span className="chapter__title">{titulo}</span>
        {subtitulo && <span className="chapter__subtitle">{subtitulo}</span>}
      </span>

      <span className="chapter__rule" />
    </div>
  );
}

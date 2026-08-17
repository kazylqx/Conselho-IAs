/**
 * Cabeçalho de uma sessão do debate. Funciona como a abertura de um capítulo:
 * número, nome da etapa, o que acontece nela e quantos conselheiros já falaram.
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
 * @param {number} [props.count] quantos conselheiros já falaram nesta rodada
 * @param {number} [props.total] quantos são esperados
 */
export function RoundDivider({ round, label, count = null, total = null }) {
  const titulo = TITULOS[round] ?? label ?? `Rodada ${round}`;
  const subtitulo = SUBTITULOS[round];
  const mostrarContador = count != null && total != null && round !== 3;

  return (
    <header className={`chapter chapter--${round}`}>
      <span className="chapter__mark" aria-hidden="true">
        <i className="chapter__diamond" />
        <span className="mono chapter__number">{String(round).padStart(2, '0')}</span>
      </span>

      <span className="chapter__text">
        <span className="chapter__title">{titulo}</span>
        {subtitulo && <span className="chapter__subtitle">{subtitulo}</span>}
      </span>

      {mostrarContador && (
        <span className="chapter__count mono" title="conselheiros que já falaram nesta rodada">
          {count}/{total}
        </span>
      )}
    </header>
  );
}

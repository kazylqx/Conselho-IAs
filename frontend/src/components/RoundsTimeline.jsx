/**
 * ============================================================================
 *  RoundsTimeline — as três rodadas do debate, em forma visual
 * ============================================================================
 * Explica o processo sem parágrafo corrido: três estações ligadas por uma linha
 * de latão. Horizontal no desktop, vertical no celular.
 */

import './RoundsTimeline.css';

const ETAPAS = [
  {
    numero: 1,
    titulo: 'Respostas iniciais',
    texto:
      'Cada IA responde sozinha, sem ver as outras. Se a pergunta depende de dado atual, todas recebem as mesmas fontes da web.',
    marca: 'independência',
  },
  {
    numero: 2,
    titulo: 'Debate',
    texto:
      'Elas leem as respostas alheias, apontam concordâncias, contestam o resto e podem buscar na web para checar o que o outro afirmou.',
    marca: 'contraditório',
  },
  {
    numero: 3,
    titulo: 'Veredito final',
    texto:
      'A juíza lê tudo e assina a resposta consolidada, com nível de confiança, pontos de consenso, divergências abertas e as fontes usadas.',
    marca: 'conclusão',
  },
];

export function RoundsTimeline() {
  return (
    <section className="rounds">
      <header className="rounds__head">
        <span className="eyebrow eyebrow--brass">como funciona</span>
        <h2 className="rounds__title">Três rodadas, uma resposta</h2>
      </header>

      <ol className="rounds__track stagger">
        {ETAPAS.map((etapa) => (
          <li className="round-step" key={etapa.numero}>
            <div className="round-step__marker">
              <span className="round-step__diamond" aria-hidden="true" />
              <span className="round-step__number mono">{String(etapa.numero).padStart(2, '0')}</span>
            </div>

            <h3 className="round-step__title">{etapa.titulo}</h3>
            <span className="round-step__badge mono">{etapa.marca}</span>
            <p className="round-step__text">{etapa.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

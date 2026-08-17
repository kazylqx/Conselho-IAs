/**
 * ============================================================================
 *  AgentEnsemble — "conheça o elenco"
 * ============================================================================
 * Apresenta o conselho antes do debate começar: quem são, que papel cada um
 * exerce e em qual modelo cada um roda. Os dados vêm de GET /api/agents, então
 * mexer no agents.config.js do backend reflete aqui sem tocar no frontend.
 */

import { useEffect, useState } from 'react';
import { AgentAvatar } from './AgentAvatar.jsx';
import { api } from '../services/api.js';
import './AgentEnsemble.css';

/** Cartão de um conselheiro. */
function CastCard({ agent, index, presiding = false }) {
  return (
    <article
      className={`cast ${presiding ? 'cast--judge' : ''}`}
      style={{ '--agent-color': agent.color ?? 'var(--brass)' }}
    >
      <span className="cast__index mono">
        {presiding ? 'preside' : String(index).padStart(2, '0')}
      </span>

      <AgentAvatar agent={agent} size={presiding ? 56 : 50} />

      <h3 className="cast__name">{agent.name}</h3>
      <span className="cast__role">{agent.role}</span>

      {agent.tagline && <p className="cast__tagline">{agent.tagline}</p>}

      <span className="cast__model mono">
        {agent.provider} · {agent.model}
      </span>
    </article>
  );
}

export function AgentEnsemble() {
  const [roster, setRoster] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api
      .roster()
      .then(setRoster)
      .catch((error) => setErro(error.message));
  }, []);

  if (erro) {
    return (
      <div className="notice notice--danger">
        <span aria-hidden="true">⚠</span>
        <span>Não foi possível carregar o conselho: {erro}</span>
      </div>
    );
  }

  return (
    <section className="ensemble">
      <header className="ensemble__head">
        <span className="eyebrow eyebrow--brass">o elenco</span>
        <h2 className="ensemble__title">Quem senta na mesa</h2>
        <p className="ensemble__lead muted">
          {roster
            ? `${roster.agents.length} conselheiros com personalidades e modelos diferentes, mais uma juíza que não opina — só consolida.`
            : 'Carregando o conselho…'}
        </p>
      </header>

      {roster && (
        <>
          <div className="ensemble__grid stagger">
            {roster.agents.map((agent, indice) => (
              <CastCard key={agent.id} agent={agent} index={indice + 1} />
            ))}
          </div>

          <div className="ensemble__judge">
            <CastCard agent={roster.judge} index={0} presiding />
          </div>
        </>
      )}
    </section>
  );
}

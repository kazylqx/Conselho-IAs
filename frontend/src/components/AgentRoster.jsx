/**
 * Vitrine do conselho: mostra quem vai debater, com papel, provedor e modelo.
 * Os dados vêm do backend (GET /api/agents), então editar o agents.config.js
 * já reflete aqui — sem duplicar configuração no frontend.
 */

import { useEffect, useState } from 'react';
import { AgentAvatar } from './AgentAvatar.jsx';
import { api } from '../services/api.js';
import './AgentRoster.css';

export function AgentRoster() {
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
      <div className="alert alert--danger">
        <span aria-hidden="true">⚠️</span>
        <span>Não foi possível carregar o conselho: {erro}</span>
      </div>
    );
  }

  if (!roster) {
    return <p className="faint">Carregando o conselho…</p>;
  }

  const participantes = [...roster.agents, roster.judge];

  return (
    <section className="roster">
      <h2 className="roster__title">
        O conselho <span className="faint">({roster.agents.length} conselheiros + juiz)</span>
      </h2>

      <div className="roster__grid">
        {participantes.map((agent) => (
          <article
            className="roster__card"
            key={agent.id}
            style={{ '--agent-color': agent.color ?? '#7c9cff' }}
          >
            <AgentAvatar agent={agent} size={40} />
            <div className="roster__info">
              <strong className="roster__name">{agent.name}</strong>
              <span className="roster__role">{agent.role}</span>
              <span className="roster__model">
                {agent.provider} · {agent.model}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * ============================================================================
 *  ChatBubble — uma fala do debate
 * ============================================================================
 * Duas variantes:
 *  - "response" (rodada 1): texto corrido da resposta independente
 *  - "debate"   (rodada 2): mostra concordâncias, discordâncias, posição
 *                           (MANTENHO/REVISO) e a resposta revisada
 */

import { AgentAvatar } from './AgentAvatar.jsx';
import { RichText } from '../utils/format.jsx';
import { duracao, horaCurta } from '../utils/time.js';
import './ChatBubble.css';

/**
 * @param {object} props
 * @param {object} props.agent  agente publico (nome, cor, avatar, papel)
 * @param {object} props.item   item da timeline (ver useDebateStream)
 */
export function ChatBubble({ agent, item }) {
  const cor = agent?.color ?? '#7c9cff';
  const estruturado = item.structured;
  const mostrarEstrutura = item.variant === 'debate' && estruturado?.parsed;

  return (
    <article className="bubble" style={{ '--agent-color': cor }}>
      <AgentAvatar agent={agent} size={42} />

      <div className="bubble__body">
        <header className="bubble__head">
          <span className="bubble__name">{agent?.name ?? item.agentId}</span>
          {agent?.role && <span className="bubble__role">{agent.role}</span>}

          {estruturado?.position && (
            <span
              className={`bubble__position bubble__position--${
                estruturado.position === 'MANTENHO' ? 'keep' : 'revise'
              }`}
            >
              {estruturado.position === 'MANTENHO' ? 'mantém a posição' : 'revisou a resposta'}
            </span>
          )}

          <span className="bubble__time">{horaCurta(item.at)}</span>
        </header>

        <div className="bubble__content">
          {mostrarEstrutura ? (
            <>
              {estruturado.agreements && (
                <section className="bubble__section bubble__section--agree">
                  <h4>Concordâncias</h4>
                  <RichText text={estruturado.agreements} />
                </section>
              )}

              {estruturado.disagreements && (
                <section className="bubble__section bubble__section--disagree">
                  <h4>Discordâncias</h4>
                  <RichText text={estruturado.disagreements} />
                </section>
              )}

              {estruturado.updatedAnswer && (
                <section className="bubble__section">
                  <h4>Resposta atualizada</h4>
                  <RichText text={estruturado.updatedAnswer} />
                </section>
              )}
            </>
          ) : (
            <RichText text={item.content} />
          )}
        </div>

        <footer className="bubble__meta">
          {item.meta?.mocked ? (
            <span className="chip chip--warn">simulado</span>
          ) : (
            item.meta?.model && <span>{item.meta.model}</span>
          )}
          {item.meta?.durationMs != null && <span>{duracao(item.meta.durationMs)}</span>}
          {item.meta?.usedWebSearch && <span>🔎 usou busca na web</span>}
        </footer>
      </div>
    </article>
  );
}

/**
 * Bolha de falha: o agente não respondeu, mas o debate continuou.
 * @param {object} props
 * @param {object} props.agent
 * @param {object} props.item
 */
export function AgentErrorBubble({ agent, item }) {
  return (
    <article className="bubble bubble--error" style={{ '--agent-color': agent?.color ?? '#fb7185' }}>
      <AgentAvatar agent={agent} size={42} failed />

      <div className="bubble__body">
        <header className="bubble__head">
          <span className="bubble__name">{agent?.name ?? item.agentId}</span>
          <span className="chip chip--danger">não respondeu</span>
          <span className="bubble__time">{horaCurta(item.at)}</span>
        </header>

        <div className="bubble__content bubble__content--error">
          <p>{item.message}</p>
          {item.detail && item.detail !== item.message && (
            <details>
              <summary>detalhes técnicos</summary>
              <p className="faint">{item.detail}</p>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}
